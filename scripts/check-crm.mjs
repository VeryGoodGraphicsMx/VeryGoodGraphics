import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const require = createRequire(import.meta.url);
const configFunction = require(resolve(root, 'netlify/functions/vgg-crm-config.js'));
const actionFunction = require(resolve(root, 'netlify/functions/vgg-crm-action.js'));
const intakeFunction = require(resolve(root, 'netlify/functions/vgg-lead-intake.js'));

const event = (httpMethod, body = null, headers = {}) => ({ httpMethod, body: body == null ? null : JSON.stringify(body), headers });
const parse = (result) => JSON.parse(result.body || '{}');

const html = await readFile(resolve(root, 'crm/index.html'), 'utf8');
const app = await readFile(resolve(root, 'crm/app.js'), 'utf8');
const schema = await readFile(resolve(root, 'supabase/schema.sql'), 'utf8');

assert.match(html, /@supabase\/supabase-js@2\.111\.0/);
assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/);
assert.match(html, /id="password-recovery-form"/);
assert.match(html, /id="new-password"[^>]*minlength="12"/);
assert.match(app, /event === 'PASSWORD_RECOVERY'/);
assert.match(app, /client\.auth\.updateUser\(\{ password \}\)/);
assert.match(app, /if \(recoveryMode\)[\s\S]*showPasswordRecovery\(\)/);
assert.doesNotMatch(`${html}\n${app}`, /VGG_SUPABASE_SECRET_KEY\s*[=:]\s*["'][^"']+/);
assert.match(schema, /alter table public\.crm_leads enable row level security;/);
assert.match(schema, /revoke all on table[\s\S]*from anon, authenticated, service_role;/);
assert.match(schema, /grant select, insert, update on table/);
assert.doesNotMatch(schema, /grant all on table/);

process.env.VGG_SUPABASE_URL = 'https://vgg-test.supabase.co';
process.env.VGG_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
process.env.VGG_SUPABASE_SECRET_KEY = 'sb_secret_test';
let result = await configFunction.handler(event('GET'));
assert.equal(result.statusCode, 200);
assert.deepEqual(parse(result), { supabaseUrl: 'https://vgg-test.supabase.co', supabasePublishableKey: 'sb_publishable_test' });
assert.doesNotMatch(result.body, /sb_secret_test/);

delete process.env.VGG_SUPABASE_URL;
delete process.env.VGG_SUPABASE_PUBLISHABLE_KEY;
delete process.env.VGG_SUPABASE_SECRET_KEY;
result = await configFunction.handler(event('GET'));
assert.equal(result.statusCode, 503);
assert.equal(parse(result).error, 'No fue posible completar la operación.');

result = await actionFunction.handler(event('POST', { action: 'create_lead', payload: {} }));
assert.equal(result.statusCode, 401);
assert.equal(parse(result).error, 'Sesión requerida.');

delete process.env.VGG_CRM_FORM_ENABLED;
result = await intakeFunction.handler(event('POST', {}, { origin: 'https://verygoodgraphics.mx' }));
assert.equal(result.statusCode, 503);
assert.equal(parse(result).error, 'No fue posible completar la operación.');

console.log('VGG CRM checks passed');

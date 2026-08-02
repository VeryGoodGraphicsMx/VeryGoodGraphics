import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
  'index.html',
  'gracias.html',
  'servicios/video.html',
  'servicios/video-producto.html',
  'servicios/video-restaurantes.html',
  'servicios/video-eventos.html',
  'servicios/fotografia.html',
  'servicios/dron.html',
];
const generatedFormPages = pages.filter((page) => page !== 'gracias.html');

for (const page of pages) {
  const file = resolve(root, page);
  const html = await readFile(file, 'utf8');
  assert.match(html, /<title>[^<]+<\/title>/, `${page}: title missing`);
  if (page !== 'gracias.html') {
    assert.match(html, /<h1[\s>]/, `${page}: H1 missing`);
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.verygoodgraphics\.mx\//, `${page}: canonical must use www`);
    assert.match(html, /<form[^>]*data-vgg-lead-form/, `${page}: progressive form fallback missing`);
    assert.match(html, /lead-form\.js/, `${page}: generated-form upgrader missing`);
  }

  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    JSON.parse(match[1]);
  }

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|#)/.test(reference)) continue;
    const clean = reference.split(/[?#]/)[0];
    if (!clean || clean === '/') continue;
    const destination = clean.startsWith('/') ? resolve(root, `.${clean}`) : resolve(dirname(file), clean);
    await access(destination).catch(() => assert.fail(`${page}: missing local reference ${reference}`));
  }
}

assert.equal(generatedFormPages.length, 7);

for (const page of pages.filter((name) => name.startsWith('servicios/'))) {
  const html = await readFile(resolve(root, page), 'utf8');
  const words = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length;
  assert.ok(words >= 220, `${page}: content is too thin (${words} words)`);
}

const home = await readFile(resolve(root, 'index.html'), 'utf8');
assert.match(home, /id="produccion-audiovisual"/);
assert.match(home, /data-vgg-lead-form/);
assert.match(home, /<form name="prospectos-vgg"[^>]*action="\/gracias\.html"/);

const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
for (const page of ['video-producto.html', 'video-restaurantes.html', 'video-eventos.html']) assert.match(sitemap, new RegExp(page.replace('.', '\\.')));

console.log(`VGG site checks passed (${pages.length} pages)`);

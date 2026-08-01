'use strict';

const DEFAULT_ORIGINS = ['https://verygoodgraphics.mx', 'https://www.verygoodgraphics.mx'];

function getEnvironment() {
  const url = String(process.env.VGG_SUPABASE_URL || '').replace(/\/$/, '');
  const publishableKey = process.env.VGG_SUPABASE_PUBLISHABLE_KEY || '';
  const secretKey = process.env.VGG_SUPABASE_SECRET_KEY || '';
  if (!url || !publishableKey || !secretKey) {
    const error = new Error('VGG CRM no está configurado.');
    error.statusCode = 503;
    throw error;
  }
  return { url, publishableKey, secretKey };
}

function allowedOrigins() {
  return (process.env.VGG_ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(','))
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function requestOrigin(event) {
  return String(event.headers?.origin || event.headers?.Origin || '').replace(/\/$/, '');
}

function corsHeaders(event) {
  const origin = requestOrigin(event);
  const allowed = allowedOrigins();
  const publicFormEndpoint = /(?:vgg-form-config|vgg-lead-intake|vgg-crm\/intake)/.test(String(event.path || event.rawUrl || ''));
  return {
    'Access-Control-Allow-Origin': (publicFormEndpoint && /^https?:\/\//.test(origin)) || allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
  };
}

function response(event, statusCode, body, extraHeaders = {}) {
  return { statusCode, headers: { ...corsHeaders(event), ...extraHeaders }, body: JSON.stringify(body) };
}

function handleOptions(event) {
  return event.httpMethod === 'OPTIONS' ? response(event, 204, {}) : null;
}

function assertMethod(event, methods) {
  if (!methods.includes(event.httpMethod)) {
    const error = new Error('Método no permitido.');
    error.statusCode = 405;
    throw error;
  }
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch (_) {
    const error = new Error('El cuerpo de la solicitud no es válido.');
    error.statusCode = 400;
    throw error;
  }
}

function bearerToken(event) {
  const value = event.headers?.authorization || event.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(value);
  if (!match) {
    const error = new Error('Sesión requerida.');
    error.statusCode = 401;
    throw error;
  }
  return match[1];
}

async function supabaseFetch(path, options = {}) {
  const { url, secretKey } = getEnvironment();
  const result = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await result.text();
  const body = text ? JSON.parse(text) : null;
  if (!result.ok) {
    const error = new Error(body?.message || body?.msg || body?.error || 'Error de base de datos.');
    error.statusCode = result.status;
    throw error;
  }
  return body;
}

async function authenticate(event, roles = []) {
  const token = bearerToken(event);
  const { url, secretKey } = getEnvironment();
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${token}` },
  });
  if (!userResponse.ok) {
    const error = new Error('La sesión expiró o no es válida.');
    error.statusCode = 401;
    throw error;
  }
  const user = await userResponse.json();
  const rows = await supabaseFetch(`/rest/v1/crm_profiles?id=eq.${encodeURIComponent(user.id)}&active=is.true&select=id,email,full_name,role,active`);
  const profile = rows?.[0];
  if (!profile) {
    const error = new Error('Tu cuenta no tiene acceso activo al CRM de VGG.');
    error.statusCode = 403;
    throw error;
  }
  if (roles.length && !roles.includes(profile.role)) {
    const error = new Error('No tienes permiso para realizar esta acción.');
    error.statusCode = 403;
    throw error;
  }
  return { user, profile, token };
}

async function select(table, query = '') {
  return supabaseFetch(`/rest/v1/${table}?${query}`);
}

async function insert(table, row) {
  return supabaseFetch(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
}

async function update(table, id, changes, extraFilter = '') {
  const filter = `id=eq.${encodeURIComponent(id)}${extraFilter ? `&${extraFilter}` : ''}`;
  return supabaseFetch(`/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(changes),
  });
}

function cleanText(value, max = 500) {
  return String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
}

function cleanEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error('El correo no es válido.');
    error.statusCode = 400;
    throw error;
  }
  return email;
}

function cleanNumber(value, min = 0, max = 100000000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    const error = new Error('Uno de los importes no es válido.');
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function cleanId(value, required = true) {
  const result = cleanText(value, 64);
  if (required && !/^[a-f0-9-]{20,64}$/i.test(result)) {
    const error = new Error('Identificador no válido.');
    error.statusCode = 400;
    throw error;
  }
  return result || null;
}

function errorResponse(event, error) {
  const statusCode = error.statusCode || 500;
  console.error('VGG CRM request failed', { message: error.message, statusCode });
  return response(event, statusCode, { error: statusCode >= 500 ? 'No fue posible completar la operación.' : error.message });
}

module.exports = {
  getEnvironment, allowedOrigins, requestOrigin, response, handleOptions, assertMethod, parseBody,
  authenticate, supabaseFetch, select, insert, update, cleanText, cleanEmail, cleanNumber, cleanId, errorResponse,
};

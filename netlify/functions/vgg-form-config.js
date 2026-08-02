'use strict';
const { response, handleOptions, assertMethod, requestOrigin, select, cleanText, errorResponse } = require('./_vgg-crm-common');

const PUBLIC_FIELD_TYPES = new Set(['text', 'email', 'tel', 'date', 'textarea', 'select', 'checkbox']);
const PUBLIC_FIELD_NAMES = new Set(['contact_name', 'email', 'phone', 'company', 'service', 'project_type', 'budget_range', 'start_window', 'event_date', 'message', 'consent']);

function host(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch (_) { return ''; }
}

function domainAllowed(origin, domains) {
  const current = host(origin);
  return Boolean(current) && Array.isArray(domains) && domains.some((domain) => {
    const allowed = host(String(domain).includes('://') ? domain : `https://${domain}`);
    const netlifyDeploy = allowed.endsWith('.netlify.app') && current.endsWith(`--${allowed}`);
    return allowed && (current === allowed || current.endsWith(`.${allowed}`) || netlifyDeploy);
  });
}

function publicForm(form) {
  return {
    slug: form.slug,
    name: form.name,
    description: cleanText(form.description, 500),
    fields: (Array.isArray(form.fields) ? form.fields : []).filter((field) => field && PUBLIC_FIELD_NAMES.has(field.name) && PUBLIC_FIELD_TYPES.has(field.type)).map((field) => ({
      name: cleanText(field.name, 80),
      label: cleanText(field.label, 160),
      type: field.type,
      required: Boolean(field.required),
      placeholder: cleanText(field.placeholder, 160) || undefined,
      autocomplete: cleanText(field.autocomplete, 80) || undefined,
      options: Array.isArray(field.options) ? field.options.map((option) => cleanText(typeof option === 'string' ? option : option?.value, 160)).filter(Boolean) : undefined,
    })).filter((field) => field.name && field.label),
    submit_label: cleanText(form.submit_label, 80) || 'Enviar solicitud',
    success_message: cleanText(form.success_message, 300) || 'Gracias. Recibimos tu solicitud.',
    privacy_url: /^https:\/\//i.test(String(form.privacy_url || '')) ? form.privacy_url : null,
  };
}
exports.handler = async (event) => {
  const options = handleOptions(event); if (options) return options;
  try {
    assertMethod(event, ['GET']);
    if (process.env.VGG_CRM_FORM_ENABLED !== 'true') { const error = new Error('Los formularios públicos aún no están activados.'); error.statusCode = 503; throw error; }
    const slug = cleanText(event.queryStringParameters?.key, 80);
    const [form] = await select('crm_forms', `slug=eq.${encodeURIComponent(slug)}&active=is.true&select=slug,name,description,allowed_domains,fields,submit_label,success_message,privacy_url`);
    if (!form) { const error = new Error('Formulario no disponible.'); error.statusCode = 404; throw error; }
    if (!domainAllowed(requestOrigin(event), form.allowed_domains)) { const error = new Error('Dominio no autorizado.'); error.statusCode = 403; throw error; }
    return response(event, 200, { form: publicForm(form) }, { 'Cache-Control': 'public,max-age=60' });
  } catch (error) { return errorResponse(event, error); }
};

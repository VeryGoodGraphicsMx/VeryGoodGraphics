'use strict';
const { response, handleOptions, assertMethod, requestOrigin, select, cleanText, errorResponse } = require('./_vgg-crm-common');
function host(value) { try { return new URL(value).hostname.toLowerCase(); } catch (_) { return ''; } }
exports.handler = async (event) => {
  const options = handleOptions(event); if (options) return options;
  try {
    assertMethod(event, ['GET']);
    if (process.env.VGG_CRM_FORM_ENABLED !== 'true') { const error = new Error('Los formularios públicos aún no están activados.'); error.statusCode = 503; throw error; }
    const slug = cleanText(event.queryStringParameters?.key, 80);
    const [form] = await select('crm_forms', `slug=eq.${encodeURIComponent(slug)}&active=is.true&select=slug,name,description,campaign,service,allowed_domains,fields,submit_label,success_message,privacy_url`);
    if (!form) { const error = new Error('Formulario no disponible.'); error.statusCode = 404; throw error; }
    const domain = host(requestOrigin(event));
    if (!domain || !form.allowed_domains.includes(domain)) { const error = new Error('Dominio no autorizado.'); error.statusCode = 403; throw error; }
    return response(event, 200, { form }, { 'Cache-Control': 'public,max-age=60' });
  } catch (error) { return errorResponse(event, error); }
};

'use strict';

const {
  allowedOrigins, requestOrigin, response, handleOptions, assertMethod, parseBody, select, insert,
  cleanText, cleanEmail, errorResponse,
} = require('./_vgg-crm-common');

const SERVICES = ['Branding', 'Diseño gráfico', 'Diseño web', 'Fotografía', 'Video', 'Dron', 'Ilustración', 'Marketing', 'Otro'];
const BUDGET_SCORES = {
  '$5,000–$15,000 MXN': 8,
  '$15,000–$35,000 MXN': 16,
  '$35,000–$75,000 MXN': 24,
  'Más de $75,000 MXN': 30,
};

function validateOrigin(event) {
  const origin = requestOrigin(event);
  if (!origin || !allowedOrigins().includes(origin)) {
    const error = new Error('Origen no permitido.');
    error.statusCode = 403;
    throw error;
  }
}

function required(value, label, max) {
  const result = cleanText(value, max);
  if (!result) {
    const error = new Error(`${label} es obligatorio.`);
    error.statusCode = 400;
    throw error;
  }
  return result;
}

function scoreLead(body) {
  let score = 25;
  score += BUDGET_SCORES[body.budget_range] || 4;
  if (cleanText(body.company, 180)) score += 8;
  if (cleanText(body.phone, 50)) score += 7;
  if (cleanText(body.message, 3000).length >= 80) score += 10;
  if (['Branding', 'Diseño web', 'Fotografía', 'Video', 'Dron', 'Marketing'].includes(body.service)) score += 8;
  if (/producto|restaurante|hospitality|evento/i.test(cleanText(body.source_detail, 240))) score += 6;
  return Math.min(100, score);
}

function host(value) { try { return new URL(value).hostname.toLowerCase(); } catch (_) { return ''; } }
function matches(rule, form, body, tracking) {
  return (!rule.form_id || rule.form_id === form?.id) && (!rule.service || rule.service === body.service) &&
    (!rule.utm_source || rule.utm_source.toLowerCase() === String(tracking.utm_source || '').toLowerCase()) &&
    (!rule.utm_campaign || rule.utm_campaign.toLowerCase() === String(tracking.utm_campaign || '').toLowerCase()) &&
    (!rule.landing_contains || String(tracking.page_url || '').includes(rule.landing_contains));
}

exports.handler = async (event) => {
  const options = handleOptions(event);
  if (options) return options;
  try {
    assertMethod(event, ['POST']);
    if (process.env.VGG_CRM_FORM_ENABLED !== 'true') {
      const error = new Error('El formulario CRM aún no está activado.');
      error.statusCode = 503;
      throw error;
    }
    if (Number(event.headers?.['content-length'] || 0) > 25000) {
      const error = new Error('La solicitud es demasiado grande.');
      error.statusCode = 413;
      throw error;
    }
    const request = parseBody(event);
    const fields = request.fields && typeof request.fields === 'object' ? request.fields : request;
    const tracking = request.tracking && typeof request.tracking === 'object' ? request.tracking : request;
    let form = null;
    if (request.form_key || request.form_id) {
      const key = cleanText(request.form_key || request.form_id, 80);
      [form] = await select('crm_forms', `slug=eq.${encodeURIComponent(key)}&active=is.true&select=*`);
      if (!form) { const error = new Error('Formulario no disponible.'); error.statusCode = 404; throw error; }
      const domain = host(tracking.page_url) || requestOrigin(event).replace(/^https?:\/\//, '');
      if (!form.allowed_domains.includes(domain)) { const error = new Error('Dominio no autorizado para este formulario.'); error.statusCode = 403; throw error; }
      for (const definition of form.fields || []) if (definition.required && !cleanText(fields[definition.name], 3000)) {
        const error = new Error(`${definition.label || definition.name} es obligatorio.`); error.statusCode = 400; throw error;
      }
    } else validateOrigin(event);
    const body = { ...fields, service: fields.service || form?.service };
    if (cleanText(body.website || body.company_url, 200)) return response(event, 202, { ok: true });
    const service = required(body.service, 'El servicio', 100);
    if (!SERVICES.includes(service)) {
      const error = new Error('El servicio no es válido.');
      error.statusCode = 400;
      throw error;
    }
    const score = scoreLead(body);
    const rules = await select('crm_assignment_rules', 'active=is.true&select=*&order=priority.asc');
    const rule = rules.find((item) => matches(item, form, body, tracking));
    const ownerId = rule?.assignee_id || form?.default_owner_id || cleanText(process.env.VGG_CRM_DEFAULT_OWNER_ID, 64) || null;
    const row = {
      contact_name: required(body.contact_name, 'El nombre', 160),
      email: cleanEmail(required(body.email, 'El correo', 254)),
      phone: cleanText(body.phone, 50) || null,
      company: cleanText(body.company, 180) || null,
      service,
      budget_range: cleanText(body.budget_range, 100) || null,
      message: cleanText(body.message, 3000) || null,
      source: cleanText(body.source, 80) || 'Sitio web',
      source_detail: cleanText(body.source_detail, 240) || null,
      utm_source: cleanText(tracking.utm_source || body.utm_source, 120) || null,
      utm_medium: cleanText(tracking.utm_medium || body.utm_medium, 120) || null,
      utm_campaign: cleanText(tracking.utm_campaign || body.utm_campaign, 180) || form?.campaign || null,
      utm_content: cleanText(tracking.utm_content, 180) || null,
      utm_term: cleanText(tracking.utm_term, 180) || null,
      click_id: cleanText(tracking.gclid || tracking.fbclid, 240) || null,
      landing_path: cleanText(body.landing_path || tracking.page_url, 300) || null,
      landing_url: cleanText(tracking.page_url, 1000) || null,
      referrer_url: cleanText(tracking.referrer, 1000) || null,
      form_id: form?.id || null,
      assignment_rule_id: rule?.id || null,
      stage: 'new',
      score,
      priority: score >= 75 ? 'urgent' : score >= 60 ? 'high' : 'normal',
      owner_id: ownerId,
      next_action_at: new Date().toISOString(),
    };
    const [lead] = await insert('crm_leads', row);
    await insert('crm_form_submissions', {
      lead_id: lead.id,
      form_id: form?.id || null,
      form_name: form?.name || cleanText(body.form_name, 120) || 'contacto-vgg',
      page_path: row.landing_path,
      visitor_id: cleanText(tracking.visitor_id, 120) || null, session_id: cleanText(tracking.session_id, 120) || null,
      page_url: row.landing_url, page_title: cleanText(tracking.page_title, 300) || null, referrer_url: row.referrer_url,
      domain: host(tracking.page_url) || null, user_agent: cleanText(event.headers?.['user-agent'], 500) || null,
      utm_source: cleanText(tracking.utm_source, 120) || null, utm_medium: cleanText(tracking.utm_medium, 120) || null,
      utm_campaign: cleanText(tracking.utm_campaign, 180) || null, utm_content: cleanText(tracking.utm_content, 180) || null, utm_term: cleanText(tracking.utm_term, 180) || null,
      payload: fields,
    });
    await insert('crm_activities', { lead_id: lead.id, kind: 'created', body: `Prospecto recibido desde ${row.source}.`, created_by: null });
    await insert('crm_tasks', {
      title: `Revisar nuevo prospecto: ${row.company || row.contact_name}`,
      status: 'pending', priority: row.priority,
      due_at: new Date(Date.now() + (score >= 75 ? 2 : 24) * 3600000).toISOString(),
      lead_id: lead.id, assigned_to: ownerId, created_by: null,
    });
    return response(event, 201, { ok: true, message: 'Gracias. Recibimos tu solicitud y te contactaremos pronto.' }, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return errorResponse(event, error);
  }
};

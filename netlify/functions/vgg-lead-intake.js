'use strict';

const {
  allowedOrigins, requestOrigin, response, handleOptions, assertMethod, parseBody, insert,
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
  if (['Branding', 'Diseño web', 'Video', 'Marketing'].includes(body.service)) score += 8;
  return Math.min(100, score);
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
    validateOrigin(event);
    if (Number(event.headers?.['content-length'] || 0) > 25000) {
      const error = new Error('La solicitud es demasiado grande.');
      error.statusCode = 413;
      throw error;
    }
    const body = parseBody(event);
    if (cleanText(body.website || body.company_url, 200)) return response(event, 202, { ok: true });
    const service = required(body.service, 'El servicio', 100);
    if (!SERVICES.includes(service)) {
      const error = new Error('El servicio no es válido.');
      error.statusCode = 400;
      throw error;
    }
    const score = scoreLead(body);
    const ownerId = cleanText(process.env.VGG_CRM_DEFAULT_OWNER_ID, 64) || null;
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
      utm_source: cleanText(body.utm_source, 120) || null,
      utm_medium: cleanText(body.utm_medium, 120) || null,
      utm_campaign: cleanText(body.utm_campaign, 180) || null,
      landing_path: cleanText(body.landing_path, 300) || null,
      stage: 'new',
      score,
      priority: score >= 75 ? 'urgent' : score >= 60 ? 'high' : 'normal',
      owner_id: ownerId,
      next_action_at: new Date().toISOString(),
    };
    const [lead] = await insert('crm_leads', row);
    await insert('crm_form_submissions', {
      lead_id: lead.id,
      form_name: cleanText(body.form_name, 120) || 'contacto-vgg',
      page_path: row.landing_path,
      payload: { service: row.service, budget_range: row.budget_range, utm_source: row.utm_source, utm_medium: row.utm_medium, utm_campaign: row.utm_campaign },
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

'use strict';

const crypto = require('node:crypto');
const { response, handleOptions, assertMethod, parseBody, select, insert, update, cleanText, errorResponse } = require('./_vgg-crm-common');

function hash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function tokenFrom(event, body = {}) {
  const token = cleanText(event.queryStringParameters?.t || body.token, 120);
  if (!/^[A-Za-z0-9_-]{40,120}$/.test(token)) { const error = new Error('La liga privada no es válida.'); error.statusCode = 404; throw error; }
  return token;
}
async function findKickoff(token) {
  const [kickoff] = await select('crm_kickoffs', `token_hash=eq.${encodeURIComponent(hash(token))}&status=in.(published,confirmed,completed)&select=*`);
  if (!kickoff) { const error = new Error('El kickoff no está disponible.'); error.statusCode = 404; throw error; }
  return kickoff;
}

exports.handler = async (event) => {
  const options = handleOptions(event); if (options) return options;
  try {
    assertMethod(event, ['GET', 'POST']);
    if (Number(event.headers?.['content-length'] || 0) > 10000) { const error = new Error('La solicitud es demasiado grande.'); error.statusCode = 413; throw error; }
    const body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const token = tokenFrom(event, body);
    const kickoff = await findKickoff(token);
    const [proposal] = await select('crm_proposals', `id=eq.${encodeURIComponent(kickoff.proposal_id)}&select=title,list_price_mxn,amount_mxn,discount_label`);
    const [project] = await select('crm_projects', `id=eq.${encodeURIComponent(kickoff.project_id)}&select=name,service,client_id,owner_id`);
    const [client] = await select('crm_clients', `id=eq.${encodeURIComponent(project.client_id)}&select=name,contact_name,email`);
    const depositAmount = Number((Number(proposal.amount_mxn) * Number(kickoff.deposit_percent) / 100).toFixed(2));

    if (event.httpMethod === 'GET' || body.action === 'view') {
      if (!kickoff.viewed_at) await update('crm_kickoffs', kickoff.id, { viewed_at: new Date().toISOString() });
      return response(event, 200, { kickoff: {
        headline: kickoff.headline, objectives: kickoff.objectives, deliverables: kickoff.deliverables,
        process_steps: kickoff.process_steps, deposit_percent: Number(kickoff.deposit_percent), deposit_amount_mxn: depositAmount,
        payment_url: kickoff.payment_url, calendar_url: kickoff.calendar_url, start_date: kickoff.start_date,
        due_date: kickoff.due_date, status: kickoff.status, confirmed_at: kickoff.confirmed_at,
        project: { name: project.name, service: project.service }, client: { name: client.contact_name, company: client.name },
        proposal: { title: proposal.title, list_price_mxn: Number(proposal.list_price_mxn || proposal.amount_mxn), amount_mxn: Number(proposal.amount_mxn), discount_label: proposal.discount_label },
      } }, { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    }

    if (body.action !== 'confirm') { const error = new Error('Acción no válida.'); error.statusCode = 400; throw error; }

    if (cleanText(body.website, 200)) return response(event, 202, { ok: true });
    if (!kickoff.confirmed_at) {
      await update('crm_kickoffs', kickoff.id, { status: 'confirmed', confirmed_at: new Date().toISOString() });
      await insert('crm_tasks', { title: `Verificar pago y agenda: ${project.name}`, status: 'pending', priority: 'high', due_at: new Date().toISOString(), project_id: kickoff.project_id, assigned_to: project.owner_id, created_by: null });
      await insert('crm_activities', { project_id: kickoff.project_id, kind: 'kickoff', body: 'El cliente confirmó que completó los pasos de pago y agenda; requiere verificación humana.', created_by: null });
    }
    return response(event, 200, { ok: true, message: 'Confirmación recibida. VGG verificará el pago y la agenda.' }, { 'Cache-Control': 'no-store' });
  } catch (error) { return errorResponse(event, error); }
};

'use strict';

const crypto = require('node:crypto');
const { response, handleOptions, assertMethod, parseBody, select, insert, update, cleanText, cleanEmail, errorResponse } = require('./_vgg-crm-common');

function hash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function tokenFrom(event, body = {}) {
  const token = cleanText(event.queryStringParameters?.t || body.token, 120);
  if (!/^[A-Za-z0-9_-]{40,120}$/.test(token)) { const error = new Error('La liga privada no es válida.'); error.statusCode = 404; throw error; }
  return token;
}

async function findProposal(token) {
  const [proposal] = await select('crm_proposals', `private_token_hash=eq.${encodeURIComponent(hash(token))}&select=id,lead_id,title,scope,client_message,deliverables,timeline,list_price_mxn,amount_mxn,discount_label,discount_expires_at,payment_url,calendar_url,status,sent_at,accepted_at,client_viewed_at`);
  if (!proposal || !['sent', 'accepted'].includes(proposal.status)) { const error = new Error('La propuesta no está disponible.'); error.statusCode = 404; throw error; }
  return proposal;
}

exports.handler = async (event) => {
  const options = handleOptions(event); if (options) return options;
  try {
    assertMethod(event, ['GET', 'POST']);
    if (Number(event.headers?.['content-length'] || 0) > 10000) { const error = new Error('La solicitud es demasiado grande.'); error.statusCode = 413; throw error; }
    const body = event.httpMethod === 'POST' ? parseBody(event) : {};
    const token = tokenFrom(event, body);
    const proposal = await findProposal(token);
    const [lead] = await select('crm_leads', `id=eq.${encodeURIComponent(proposal.lead_id)}&select=contact_name,company,email,service`);
    const listPrice = Number(proposal.list_price_mxn || proposal.amount_mxn);
    const finalPrice = Number(proposal.amount_mxn);
    const savings = Math.max(0, listPrice - finalPrice);
    const discountExpired = Boolean(savings && proposal.discount_expires_at && Date.now() > Date.parse(proposal.discount_expires_at));

    if (event.httpMethod === 'GET' || body.action === 'view') {
      if (!proposal.client_viewed_at) await update('crm_proposals', proposal.id, { client_viewed_at: new Date().toISOString() });
      return response(event, 200, { proposal: {
        title: proposal.title, scope: proposal.scope, client_message: proposal.client_message,
        deliverables: proposal.deliverables, timeline: proposal.timeline, list_price_mxn: listPrice,
        amount_mxn: finalPrice, savings_mxn: savings, discount_label: proposal.discount_label,
        discount_expires_at: proposal.discount_expires_at, discount_expired: discountExpired,
        status: proposal.status, accepted_at: proposal.accepted_at, payment_url: proposal.payment_url,
        calendar_url: proposal.calendar_url, client: { name: lead?.contact_name, company: lead?.company, service: lead?.service },
      } }, { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    }

    if (body.action !== 'accept') { const error = new Error('Acción no válida.'); error.statusCode = 400; throw error; }

    if (cleanText(body.website, 200)) return response(event, 202, { ok: true });
    if (proposal.status === 'accepted') return response(event, 200, { ok: true, accepted: true, payment_url: proposal.payment_url });
    if (discountExpired) { const error = new Error('La vigencia del beneficio terminó. Contacta a VGG para actualizar la propuesta.'); error.statusCode = 409; throw error; }
    const acceptedName = cleanText(body.name, 160);
    const acceptedEmail = cleanEmail(body.email);
    if (!acceptedName || !acceptedEmail) { const error = new Error('Confirma tu nombre y correo para aceptar.'); error.statusCode = 400; throw error; }
    await update('crm_proposals', proposal.id, { status: 'accepted', accepted_at: new Date().toISOString(), accepted_by_name: acceptedName, accepted_by_email: acceptedEmail });
    await update('crm_leads', proposal.lead_id, { stage: 'won' });
    await insert('crm_activities', { lead_id: proposal.lead_id, kind: 'proposal', body: `Propuesta aceptada por ${acceptedName}.`, created_by: null });
    return response(event, 200, { ok: true, accepted: true, message: 'Propuesta aceptada. VGG preparará el anticipo y kickoff.', payment_url: proposal.payment_url }, { 'Cache-Control': 'no-store' });
  } catch (error) { return errorResponse(event, error); }
};

'use strict';

const crypto = require('node:crypto');

const {
  response, handleOptions, assertMethod, parseBody, authenticate, supabaseFetch, select, insert, update,
  cleanText, cleanEmail, cleanNumber, cleanId, errorResponse,
} = require('./_vgg-crm-common');

const LEAD_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const TASK_STATUSES = ['pending', 'done', 'cancelled'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const ROLES = ['owner', 'sales', 'production'];
const TEAMS = ['direction', 'commercial', 'production', 'viewer'];
const FORM_FIELD_TYPES = ['text', 'email', 'tel', 'textarea', 'select', 'checkbox'];
const FORM_FIELD_NAMES = ['contact_name', 'email', 'phone', 'company', 'service', 'budget_range', 'message', 'consent'];

function cleanUrl(value) {
  const result = cleanText(value, 1000);
  if (!result) return null;
  try {
    const url = new URL(result);
    if (url.protocol !== 'https:') throw new Error();
    return url.toString();
  } catch (_) {
    const error = new Error('Las ligas deben ser HTTPS válidas.'); error.statusCode = 400; throw error;
  }
}

function cleanDate(value) {
  const result = cleanText(value, 40);
  if (!result) return null;
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?/.test(result) || Number.isNaN(Date.parse(result))) {
    const error = new Error('Una de las fechas no es válida.'); error.statusCode = 400; throw error;
  }
  return result;
}

function cleanList(value, maxItems = 20) {
  const source = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
  return source.map((item) => cleanText(typeof item === 'string' ? item : item?.label || item?.title, 300)).filter(Boolean).slice(0, maxItems);
}

function requireList(value, label) {
  const items = cleanList(value);
  if (!items.length) { const error = new Error(`${label} requiere al menos un elemento.`); error.statusCode = 400; throw error; }
  return items;
}

function privateToken() { return crypto.randomBytes(32).toString('base64url'); }
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function publicBaseUrl() { return String(process.env.DEPLOY_PRIME_URL || process.env.URL || 'https://www.verygoodgraphics.mx').replace(/\/$/, ''); }

function cleanBoolean(value) {
  return value === true || value === 1 || value === 'true' || value === 'on';
}

function requireValue(value, label, max = 300) {
  const result = cleanText(value, max);
  if (!result) {
    const error = new Error(`${label} es obligatorio.`);
    error.statusCode = 400;
    throw error;
  }
  return result;
}

function assertChoice(value, allowed, label) {
  if (!allowed.includes(value)) {
    const error = new Error(`${label} no es válido.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function ownershipFilter(profile, column = 'owner_id') {
  return profile.role === 'owner' ? '' : `${column}=eq.${encodeURIComponent(profile.id)}`;
}

async function mustUpdate(table, recordId, changes, filter = '') {
  const rows = await update(table, recordId, changes, filter);
  if (!rows?.length) {
    const error = new Error('El registro no existe o no tienes acceso.');
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
}

async function createLead(payload, profile) {
  const row = {
    contact_name: requireValue(payload.contact_name, 'El nombre', 160),
    email: cleanEmail(payload.email),
    phone: cleanText(payload.phone, 50) || null,
    company: cleanText(payload.company, 180) || null,
    service: requireValue(payload.service, 'El servicio', 100),
    budget_range: cleanText(payload.budget_range, 100) || null,
    message: cleanText(payload.message, 3000) || null,
    stage: 'new', priority: 'normal', score: 45, source: 'Captura manual', owner_id: profile.id,
    next_action_at: new Date().toISOString(), created_by: profile.id,
  };
  const [lead] = await insert('crm_leads', row);
  await insert('crm_activities', { lead_id: lead.id, kind: 'created', body: 'Prospecto registrado manualmente.', created_by: profile.id });
  return { message: 'Prospecto registrado.', record: lead };
}

async function changeStage(payload, profile) {
  const leadId = cleanId(payload.lead_id);
  const stage = assertChoice(payload.stage, LEAD_STAGES, 'La etapa');
  const filter = ownershipFilter(profile);
  const query = `id=eq.${encodeURIComponent(leadId)}&select=id,stage,owner_id${filter ? `&${filter}` : ''}`;
  const [current] = await select('crm_leads', query);
  if (!current) {
    const error = new Error('El prospecto no existe o no tienes acceso.');
    error.statusCode = 404;
    throw error;
  }
  const lead = await mustUpdate('crm_leads', leadId, { stage }, filter);
  await insert('crm_activities', { lead_id: leadId, kind: 'stage_change', body: `Etapa actualizada de ${current.stage} a ${stage}.`, created_by: profile.id });
  return { message: 'Etapa actualizada.', record: lead };
}

async function createTask(payload, profile) {
  const priority = assertChoice(payload.priority || 'normal', PRIORITIES, 'La prioridad');
  const row = {
    title: requireValue(payload.title, 'La tarea', 240),
    due_at: requireValue(payload.due_at, 'La fecha límite', 40),
    priority, status: 'pending',
    lead_id: payload.lead_id ? cleanId(payload.lead_id) : null,
    project_id: payload.project_id ? cleanId(payload.project_id) : null,
    assigned_to: profile.id, created_by: profile.id,
  };
  const [task] = await insert('crm_tasks', row);
  return { message: 'Tarea creada.', record: task };
}

async function toggleTask(payload, profile) {
  const taskId = cleanId(payload.task_id);
  const status = assertChoice(payload.status, TASK_STATUSES, 'El estado');
  const filter = ownershipFilter(profile, 'assigned_to');
  const task = await mustUpdate('crm_tasks', taskId, { status, completed_at: status === 'done' ? new Date().toISOString() : null }, filter);
  return { message: status === 'done' ? 'Tarea completada.' : 'Tarea reabierta.', record: task };
}

async function saveProposal(payload, profile) {
  const leadId = cleanId(payload.lead_id);
  const amount = cleanNumber(payload.amount_mxn, 1);
  const listPrice = cleanNumber(payload.list_price_mxn || amount, amount);
  const cost = cleanNumber(payload.estimated_cost_mxn, 0);
  const discountExpiresAt = listPrice > amount ? cleanDate(payload.discount_expires_at) : null;
  if (listPrice > amount && (!discountExpiresAt || Date.parse(discountExpiresAt) <= Date.now())) {
    const error = new Error('El descuento debe tener una vigencia futura y auténtica.'); error.statusCode = 400; throw error;
  }
  const margin = ((amount - cost) / amount) * 100;
  const leadFilter = ownershipFilter(profile);
  const ownedLead = await select('crm_leads', `id=eq.${encodeURIComponent(leadId)}&select=id${leadFilter ? `&${leadFilter}` : ''}`);
  if (!ownedLead?.length) {
    const error = new Error('El prospecto no existe o no tienes acceso.');
    error.statusCode = 404;
    throw error;
  }
  const [proposal] = await insert('crm_proposals', {
    lead_id: leadId,
    title: requireValue(payload.title, 'El título', 220),
    scope: requireValue(payload.scope, 'El alcance', 6000),
    client_message: cleanText(payload.client_message, 1800) || null,
    deliverables: requireList(payload.deliverables, 'Entregables'), timeline: requireList(payload.timeline, 'La ruta de trabajo'),
    list_price_mxn: listPrice,
    discount_label: listPrice > amount ? cleanText(payload.discount_label, 180) || 'Beneficio por decisión ágil' : null,
    discount_expires_at: discountExpiresAt,
    payment_url: cleanUrl(payload.payment_url), calendar_url: cleanUrl(payload.calendar_url),
    amount_mxn: amount,
    estimated_cost_mxn: cost,
    margin_percent: Number(margin.toFixed(2)),
    status: 'draft', owner_id: profile.id, created_by: profile.id,
  });
  await update('crm_leads', leadId, { stage: 'proposal' }, leadFilter);
  await insert('crm_activities', { lead_id: leadId, kind: 'proposal', body: `Propuesta creada por ${amount.toFixed(2)} MXN con margen estimado de ${margin.toFixed(1)}%.`, created_by: profile.id });
  return { message: margin >= 50 ? 'Borrador guardado y listo para aprobación.' : 'Borrador guardado; el margen requiere revisión.', record: proposal };
}

async function approveProposal(payload, profile) {
  const proposalId = cleanId(payload.proposal_id);
  const [proposal] = await select('crm_proposals', `id=eq.${encodeURIComponent(proposalId)}&select=id,lead_id,status,margin_percent`);
  if (!proposal) {
    const error = new Error('La propuesta no existe.');
    error.statusCode = 404;
    throw error;
  }
  if (proposal.status !== 'draft') {
    const error = new Error('Solo se pueden aprobar borradores.');
    error.statusCode = 409;
    throw error;
  }
  if (Number(proposal.margin_percent) < 50) {
    const error = new Error('El margen es menor al 50%; ajusta precio o costo antes de aprobar.');
    error.statusCode = 409;
    throw error;
  }
  const record = await mustUpdate('crm_proposals', proposalId, { status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString() });
  await insert('crm_activities', { lead_id: proposal.lead_id, kind: 'proposal', body: 'Propuesta aprobada internamente por Dirección.', created_by: profile.id });
  return { message: 'Propuesta aprobada internamente.', record };
}

async function saveProject(payload, profile) {
  const budget = cleanNumber(payload.budget_mxn || 0, 0);
  const cost = cleanNumber(payload.cost_mxn || 0, 0);
  const [project] = await insert('crm_projects', {
    client_id: cleanId(payload.client_id),
    name: requireValue(payload.name, 'El nombre del proyecto', 220),
    service: requireValue(payload.service, 'El servicio', 120),
    due_date: cleanText(payload.due_date, 40) || null,
    budget_mxn: budget, cost_mxn: cost, spent_mxn: 0,
    status: 'kickoff', progress: 5, owner_id: profile.id, created_by: profile.id,
  });
  return { message: 'Proyecto creado; ya puede prepararse el kickoff.', record: project };
}

async function savePayment(payload, profile) {
  const [payment] = await insert('crm_payments', {
    project_id: cleanId(payload.project_id),
    concept: requireValue(payload.concept, 'El concepto', 180),
    amount_mxn: cleanNumber(payload.amount_mxn, 1),
    due_date: requireValue(payload.due_date, 'La fecha de cobro', 40),
    status: 'pending', created_by: profile.id,
  });
  return { message: 'Cobro programado.', record: payment };
}

async function markPaymentPaid(payload, profile) {
  const record = await mustUpdate('crm_payments', cleanId(payload.payment_id), { status: 'paid', paid_at: new Date().toISOString(), recorded_by: profile.id });
  return { message: 'Pago confirmado.', record };
}

async function generateProposalLink(payload, profile) {
  const proposalId = cleanId(payload.proposal_id);
  const [proposal] = await select('crm_proposals', `id=eq.${encodeURIComponent(proposalId)}&select=id,lead_id,status,margin_percent`);
  if (!proposal) { const error = new Error('La propuesta no existe.'); error.statusCode = 404; throw error; }
  if (!['approved', 'sent'].includes(proposal.status)) { const error = new Error('Dirección debe aprobar la propuesta antes de generar la liga.'); error.statusCode = 409; throw error; }
  if (Number(proposal.margin_percent) < 50) { const error = new Error('La propuesta no cumple el margen mínimo de 50%.'); error.statusCode = 409; throw error; }
  const token = privateToken();
  const record = await mustUpdate('crm_proposals', proposalId, { private_token_hash: tokenHash(token), status: 'sent', sent_at: new Date().toISOString() });
  await insert('crm_activities', { lead_id: proposal.lead_id, kind: 'proposal', body: 'Liga privada de propuesta generada por Dirección.', created_by: profile.id });
  return { message: 'Liga privada generada y copiada.', url: `${publicBaseUrl()}/propuesta.html#t=${encodeURIComponent(token)}`, record };
}

async function generateKickoff(payload, profile) {
  const proposalId = cleanId(payload.proposal_id);
  const [proposal] = await select('crm_proposals', `id=eq.${encodeURIComponent(proposalId)}&select=id,lead_id,title,scope,amount_mxn,estimated_cost_mxn,status,payment_url,calendar_url,deliverables`);
  if (!proposal) { const error = new Error('La propuesta no existe.'); error.statusCode = 404; throw error; }
  if (proposal.status !== 'accepted') { const error = new Error('El cliente debe aceptar la propuesta antes de publicar el kickoff.'); error.statusCode = 409; throw error; }
  const [lead] = await select('crm_leads', `id=eq.${encodeURIComponent(proposal.lead_id)}&select=id,contact_name,company,email,phone,service,owner_id`);
  if (!lead) { const error = new Error('No se encontró el prospecto relacionado.'); error.statusCode = 404; throw error; }

  let [client] = await select('crm_clients', `lead_id=eq.${encodeURIComponent(lead.id)}&select=*`);
  if (!client) [client] = await insert('crm_clients', { name: lead.company || lead.contact_name, contact_name: lead.contact_name, email: lead.email, phone: lead.phone, lead_id: lead.id, owner_id: lead.owner_id || profile.id });

  let [project] = await select('crm_projects', `proposal_id=eq.${encodeURIComponent(proposal.id)}&select=*`);
  const dueDate = cleanDate(payload.due_date);
  if (!project) [project] = await insert('crm_projects', {
    client_id: client.id, proposal_id: proposal.id, name: cleanText(payload.project_name, 220) || proposal.title,
    service: lead.service || 'Proyecto VGG', status: 'kickoff', progress: 5, due_date: dueDate,
    budget_mxn: proposal.amount_mxn, cost_mxn: proposal.estimated_cost_mxn, spent_mxn: 0,
    owner_id: lead.owner_id || profile.id, created_by: profile.id,
  });
  else project = await mustUpdate('crm_projects', project.id, {
    name: cleanText(payload.project_name, 220) || proposal.title, due_date: dueDate,
    budget_mxn: proposal.amount_mxn, cost_mxn: proposal.estimated_cost_mxn,
  });

  const depositPercent = cleanNumber(payload.deposit_percent === '' || payload.deposit_percent == null ? 50 : payload.deposit_percent, 0, 100);
  const paymentUrl = cleanUrl(payload.payment_url || proposal.payment_url);
  const calendarUrl = cleanUrl(payload.calendar_url || proposal.calendar_url);
  const token = privateToken();
  const objectives = requireList(payload.objectives, 'Objetivos');
  const deliverables = requireList(payload.deliverables || proposal.deliverables, 'Entregables');
  const processSteps = requireList(payload.process_steps, 'El proceso');
  const row = {
    proposal_id: proposal.id, project_id: project.id, token_hash: tokenHash(token),
    headline: cleanText(payload.headline, 240) || `El siguiente paso para ${lead.company || lead.contact_name}`,
    objectives, deliverables, process_steps: processSteps, deposit_percent: depositPercent,
    payment_url: paymentUrl, calendar_url: calendarUrl, start_date: cleanDate(payload.start_date), due_date: dueDate,
    status: 'published', created_by: profile.id,
  };
  const [existing] = await select('crm_kickoffs', `proposal_id=eq.${encodeURIComponent(proposal.id)}&select=id`);
  const kickoff = existing ? await mustUpdate('crm_kickoffs', existing.id, row) : (await insert('crm_kickoffs', row))[0];
  const paymentRows = await select('crm_payments', `project_id=eq.${encodeURIComponent(project.id)}&select=id&limit=1`);
  if (!paymentRows.length && depositPercent > 0) await insert('crm_payments', {
    project_id: project.id, concept: `Anticipo ${depositPercent}%`, amount_mxn: Number((Number(proposal.amount_mxn) * depositPercent / 100).toFixed(2)),
    due_date: new Date().toISOString().slice(0, 10), status: 'pending', created_by: profile.id,
  });
  await insert('crm_activities', { lead_id: lead.id, project_id: project.id, kind: 'kickoff', body: 'Kickoff privado publicado por Dirección.', created_by: profile.id });
  return { message: 'Kickoff generado y liga copiada.', url: `${publicBaseUrl()}/kickoff.html#t=${encodeURIComponent(token)}`, record: kickoff };
}

function cleanSlug(value) {
  const slug = cleanText(value, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(slug)) {
    const error = new Error('El identificador del formulario no es válido.'); error.statusCode = 400; throw error;
  }
  return slug;
}

function cleanDomains(value) {
  const entries = Array.isArray(value) ? value : String(value || '').split(/[\n,]+/);
  return [...new Set(entries.map((item) => cleanText(item, 180)
    .replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase())
    .filter((item) => /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(item)))];
}

function cleanFormFields(value) {
  const source = Array.isArray(value) ? value : [];
  const names = new Set();
  const fields = source.map((field) => {
    const name = cleanText(field?.name, 80);
    const type = cleanText(field?.type, 30);
    if (!FORM_FIELD_NAMES.includes(name) || !FORM_FIELD_TYPES.includes(type) || names.has(name)) return null;
    names.add(name);
    const result = {
      name,
      label: cleanText(field.label, 160) || name,
      type,
      required: Boolean(field.required),
    };
    const placeholder = cleanText(field.placeholder, 160);
    const autocomplete = cleanText(field.autocomplete, 80);
    if (placeholder) result.placeholder = placeholder;
    if (autocomplete) result.autocomplete = autocomplete;
    if (type === 'select') {
      result.options = (Array.isArray(field.options) ? field.options : []).map((option) => cleanText(option, 160)).filter(Boolean).slice(0, 40);
      if (!result.options.length) return null;
    }
    return result;
  }).filter(Boolean);
  for (const requiredName of ['contact_name', 'email']) {
    const field = fields.find((item) => item.name === requiredName);
    if (!field) {
      const error = new Error('Nombre y correo deben estar incluidos.'); error.statusCode = 400; throw error;
    }
    field.required = true;
  }
  return fields;
}

async function inviteUser(payload, profile) {
  const email = cleanEmail(requireValue(payload.email, 'El correo', 254));
  const role = assertChoice(payload.role || 'sales', ROLES, 'El rol');
  const team = assertChoice(payload.team || (role === 'production' ? 'production' : 'commercial'), TEAMS, 'El equipo');
  const redirect = encodeURIComponent('https://www.verygoodgraphics.mx/crm/');
  const user = await supabaseFetch(`/auth/v1/invite?redirect_to=${redirect}`, { method: 'POST', body: JSON.stringify({ email, data: { full_name: requireValue(payload.full_name, 'El nombre', 160) } }) });
  const [record] = await insert('crm_profiles', { id: user.id, email, full_name: requireValue(payload.full_name, 'El nombre', 160), role, team, active: true });
  return { message: 'Invitación enviada y usuario agregado al equipo.', record };
}

async function updateProfile(payload) {
  const changes = {
    role: assertChoice(payload.role, ROLES, 'El rol'),
    team: assertChoice(payload.team, TEAMS, 'El equipo'),
    active: cleanBoolean(payload.active),
  };
  return { message: 'Usuario actualizado.', record: await mustUpdate('crm_profiles', cleanId(payload.profile_id), changes) };
}

async function assignLead(payload, profile) {
  const leadId = cleanId(payload.lead_id);
  const ownerId = payload.owner_id ? cleanId(payload.owner_id) : null;
  if (ownerId) {
    const [owner] = await select('crm_profiles', `id=eq.${encodeURIComponent(ownerId)}&active=is.true&select=id,full_name`);
    if (!owner) { const error = new Error('El responsable no está activo.'); error.statusCode = 400; throw error; }
  }
  const record = await mustUpdate('crm_leads', leadId, { owner_id: ownerId });
  await insert('crm_activities', { lead_id: leadId, kind: 'assignment', body: ownerId ? 'Responsable actualizado por Dirección.' : 'Prospecto dejado sin asignar.', created_by: profile.id });
  return { message: ownerId ? 'Prospecto asignado.' : 'Prospecto sin asignar.', record };
}

async function saveForm(payload, profile) {
  const fields = cleanFormFields(payload.fields);
  if (!fields.length) { const error = new Error('Agrega al menos un campo.'); error.statusCode = 400; throw error; }
  const active = cleanBoolean(payload.active);
  const allowedDomains = cleanDomains(payload.allowed_domains);
  if (active && !allowedDomains.length) { const error = new Error('Agrega al menos un dominio antes de activar.'); error.statusCode = 400; throw error; }
  const privacyUrl = cleanUrl(payload.privacy_url);
  if (fields.some((field) => field.name === 'consent') && !privacyUrl) {
    const error = new Error('El consentimiento requiere una liga HTTPS al aviso de privacidad.'); error.statusCode = 400; throw error;
  }
  const row = {
    slug: cleanSlug(payload.slug || payload.name), name: requireValue(payload.name, 'El nombre', 160),
    description: cleanText(payload.description, 500) || null, campaign: cleanText(payload.campaign, 180) || null,
    service: cleanText(payload.service, 120) || null, active,
    allowed_domains: allowedDomains,
    fields, submit_label: cleanText(payload.submit_label, 80) || 'Enviar solicitud',
    success_message: cleanText(payload.success_message, 300) || 'Gracias. Recibimos tu solicitud.',
    privacy_url: privacyUrl,
    default_owner_id: payload.default_owner_id ? cleanId(payload.default_owner_id) : null,
  };
  const record = payload.form_id ? await mustUpdate('crm_forms', cleanId(payload.form_id), row) : (await insert('crm_forms', { ...row, created_by: profile.id }))[0];
  return { message: 'Formulario guardado.', record };
}

async function saveAssignmentRule(payload, profile) {
  const row = {
    name: requireValue(payload.name, 'El nombre', 160), priority: cleanNumber(payload.priority || 100, 1, 9999), active: cleanBoolean(payload.active),
    form_id: payload.form_id ? cleanId(payload.form_id) : null, service: cleanText(payload.service, 120) || null,
    utm_source: cleanText(payload.utm_source, 120) || null, utm_campaign: cleanText(payload.utm_campaign, 180) || null,
    landing_contains: cleanText(payload.landing_contains, 300) || null, assignee_id: cleanId(payload.assignee_id),
  };
  const record = payload.rule_id ? await mustUpdate('crm_assignment_rules', cleanId(payload.rule_id), row) : (await insert('crm_assignment_rules', { ...row, created_by: profile.id }))[0];
  return { message: 'Regla de asignación guardada.', record };
}

const ACTIONS = {
  create_lead: { roles: ['owner', 'sales'], run: createLead },
  change_stage: { roles: ['owner', 'sales'], run: changeStage },
  create_task: { roles: ['owner', 'sales', 'production'], run: createTask },
  toggle_task: { roles: ['owner', 'sales', 'production'], run: toggleTask },
  save_proposal: { roles: ['owner', 'sales'], run: saveProposal },
  approve_proposal: { roles: ['owner'], run: approveProposal },
  generate_proposal_link: { roles: ['owner'], run: generateProposalLink },
  generate_kickoff: { roles: ['owner'], run: generateKickoff },
  save_project: { roles: ['owner'], run: saveProject },
  save_payment: { roles: ['owner'], run: savePayment },
  mark_payment_paid: { roles: ['owner'], run: markPaymentPaid },
  invite_user: { roles: ['owner'], run: inviteUser },
  update_profile: { roles: ['owner'], run: updateProfile },
  assign_lead: { roles: ['owner'], run: assignLead },
  save_form: { roles: ['owner'], run: saveForm },
  save_assignment_rule: { roles: ['owner'], run: saveAssignmentRule },
};

exports.handler = async (event) => {
  const options = handleOptions(event);
  if (options) return options;
  try {
    assertMethod(event, ['POST']);
    const body = parseBody(event);
    const definition = ACTIONS[body.action];
    if (!definition) {
      const error = new Error('Acción no reconocida.');
      error.statusCode = 400;
      throw error;
    }
    const { profile } = await authenticate(event, definition.roles);
    const result = await definition.run(body.payload || {}, profile);
    return response(event, 200, result, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return errorResponse(event, error);
  }
};

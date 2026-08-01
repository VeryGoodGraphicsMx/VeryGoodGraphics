'use strict';

const {
  response, handleOptions, assertMethod, parseBody, authenticate, select, insert, update,
  cleanText, cleanEmail, cleanNumber, cleanId, errorResponse,
} = require('./_vgg-crm-common');

const LEAD_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const TASK_STATUSES = ['pending', 'done', 'cancelled'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

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
  const cost = cleanNumber(payload.estimated_cost_mxn, 0);
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

const ACTIONS = {
  create_lead: { roles: ['owner', 'sales'], run: createLead },
  change_stage: { roles: ['owner', 'sales'], run: changeStage },
  create_task: { roles: ['owner', 'sales', 'production'], run: createTask },
  toggle_task: { roles: ['owner', 'sales', 'production'], run: toggleTask },
  save_proposal: { roles: ['owner', 'sales'], run: saveProposal },
  approve_proposal: { roles: ['owner'], run: approveProposal },
  save_project: { roles: ['owner'], run: saveProject },
  save_payment: { roles: ['owner'], run: savePayment },
  mark_payment_paid: { roles: ['owner'], run: markPaymentPaid },
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

'use strict';

const { response, handleOptions, assertMethod, authenticate, select, errorResponse } = require('./_vgg-crm-common');

const QUERIES = {
  leads: 'select=id,contact_name,company,email,phone,service,budget_range,stage,priority,score,source,message,owner_id,next_action_at,created_at&order=created_at.desc',
  clients: 'select=id,name,contact_name,email,phone,created_at&order=name.asc',
  proposals: 'select=id,lead_id,title,scope,amount_mxn,estimated_cost_mxn,margin_percent,status,owner_id,approved_by,approved_at,sent_at,created_at&order=created_at.desc',
  projects: 'select=id,client_id,proposal_id,name,service,status,progress,due_date,budget_mxn,cost_mxn,spent_mxn,owner_id,created_at&order=created_at.desc',
  tasks: 'select=id,title,status,priority,due_at,lead_id,project_id,assigned_to,completed_at,created_at&order=due_at.asc',
  payments: 'select=id,project_id,concept,amount_mxn,due_date,status,paid_at,created_at&order=due_date.asc',
  activities: 'select=id,lead_id,project_id,kind,body,created_by,created_at&order=created_at.desc&limit=500',
};

function scopedQuery(name, query, profile) {
  if (profile.role === 'owner') return query;
  const profileId = encodeURIComponent(profile.id);
  if (profile.role === 'sales') {
    if (name === 'leads' || name === 'proposals') return `${query}&owner_id=eq.${profileId}`;
    if (name === 'tasks') return `${query}&assigned_to=eq.${profileId}`;
    if (name === 'projects' || name === 'payments' || name === 'clients') return `${query}&limit=0`;
  }
  if (profile.role === 'production') {
    if (name === 'projects') return `${query}&owner_id=eq.${profileId}`;
    if (name === 'tasks') return `${query}&assigned_to=eq.${profileId}`;
    return `${query}&limit=0`;
  }
  return `${query}&limit=0`;
}

exports.handler = async (event) => {
  const options = handleOptions(event);
  if (options) return options;
  try {
    assertMethod(event, ['GET']);
    const { profile } = await authenticate(event, ['owner', 'sales', 'production']);
    const entries = await Promise.all(Object.entries(QUERIES).map(async ([name, query]) => [name, await select(`crm_${name}`, scopedQuery(name, query, profile))]));
    return response(event, 200, {
      profile,
      ...Object.fromEntries(entries),
      system: {
        form: process.env.VGG_CRM_FORM_ENABLED === 'true',
        automation: process.env.VGG_CRM_AUTOMATION_ENABLED === 'true',
      },
    }, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return errorResponse(event, error);
  }
};

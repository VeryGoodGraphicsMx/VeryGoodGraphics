'use strict';

const { response, handleOptions, assertMethod, authenticate, select, errorResponse } = require('./_vgg-crm-common');

const QUERIES = {
  leads: 'select=id,contact_name,company,email,phone,service,budget_range,stage,priority,score,source,message,owner_id,form_id,landing_url,referrer_url,utm_source,utm_medium,utm_campaign,utm_content,utm_term,click_id,assignment_rule_id,next_action_at,created_at&order=created_at.desc',
  clients: 'select=id,name,contact_name,email,phone,created_at&order=name.asc',
  proposals: 'select=id,lead_id,title,scope,client_message,deliverables,timeline,list_price_mxn,amount_mxn,estimated_cost_mxn,margin_percent,discount_label,discount_expires_at,payment_url,calendar_url,status,owner_id,approved_by,approved_at,sent_at,client_viewed_at,accepted_at,accepted_by_name,accepted_by_email,created_at&order=created_at.desc',
  projects: 'select=id,client_id,proposal_id,name,service,status,progress,due_date,budget_mxn,cost_mxn,spent_mxn,owner_id,created_at&order=created_at.desc',
  tasks: 'select=id,title,status,priority,due_at,lead_id,project_id,assigned_to,completed_at,created_at&order=due_at.asc',
  payments: 'select=id,project_id,concept,amount_mxn,due_date,status,paid_at,created_at&order=due_date.asc',
  activities: 'select=id,lead_id,project_id,kind,body,created_by,created_at&order=created_at.desc&limit=500',
  profiles: 'select=id,email,full_name,role,team,active,created_at&order=full_name.asc',
  forms: 'select=id,slug,name,description,campaign,service,active,allowed_domains,fields,submit_label,success_message,privacy_url,default_owner_id,created_at,updated_at&order=created_at.desc',
  assignment_rules: 'select=id,name,priority,active,form_id,service,utm_source,utm_campaign,landing_contains,assignee_id,created_at&order=priority.asc',
  form_submissions: 'select=id,lead_id,form_id,form_name,page_url,domain,utm_source,utm_medium,utm_campaign,created_at&order=created_at.desc&limit=250',
  kickoffs: 'select=id,proposal_id,project_id,headline,objectives,deliverables,process_steps,deposit_percent,payment_url,calendar_url,start_date,due_date,status,viewed_at,confirmed_at,created_at&order=created_at.desc',
};

function scopedQuery(name, query, profile) {
  if (profile.role === 'owner') return query;
  if (['profiles', 'forms', 'assignment_rules', 'form_submissions', 'kickoffs'].includes(name)) return `${query}&limit=0`;
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

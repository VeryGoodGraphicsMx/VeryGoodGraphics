-- VGG CRM baseline schema
-- Apply only to a Supabase project owned by VGG. Never run this in AMITAI.

create extension if not exists pgcrypto;

create or replace function public.vgg_crm_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.vgg_crm_touch_updated_at() from public, anon, authenticated;
grant execute on function public.vgg_crm_touch_updated_at() to service_role;

create table if not exists public.crm_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null default 'sales' check (role in ('owner', 'sales', 'production')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  company text,
  email text not null,
  phone text,
  service text,
  budget_range text,
  message text,
  stage text not null default 'new' check (stage in ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  score integer not null default 0 check (score between 0 and 100),
  source text not null default 'Manual',
  source_detail text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  landing_path text,
  owner_id uuid references public.crm_profiles(id) on delete set null,
  created_by uuid references public.crm_profiles(id) on delete set null,
  next_action_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  lead_id uuid references public.crm_leads(id) on delete set null,
  owner_id uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_proposals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  title text not null,
  scope text not null,
  amount_mxn numeric(14,2) not null check (amount_mxn > 0),
  estimated_cost_mxn numeric(14,2) not null default 0 check (estimated_cost_mxn >= 0),
  margin_percent numeric(6,2) not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'accepted', 'rejected')),
  owner_id uuid references public.crm_profiles(id) on delete set null,
  created_by uuid references public.crm_profiles(id) on delete set null,
  approved_by uuid references public.crm_profiles(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  private_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.crm_clients(id) on delete restrict,
  proposal_id uuid references public.crm_proposals(id) on delete set null,
  name text not null,
  service text not null,
  status text not null default 'kickoff' check (status in ('kickoff', 'production', 'review', 'delivery', 'completed', 'paused', 'cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  due_date date,
  budget_mxn numeric(14,2) not null default 0 check (budget_mxn >= 0),
  cost_mxn numeric(14,2) not null default 0 check (cost_mxn >= 0),
  spent_mxn numeric(14,2) not null default 0 check (spent_mxn >= 0),
  owner_id uuid references public.crm_profiles(id) on delete set null,
  created_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at timestamptz not null,
  lead_id uuid references public.crm_leads(id) on delete cascade,
  project_id uuid references public.crm_projects(id) on delete cascade,
  assigned_to uuid references public.crm_profiles(id) on delete set null,
  created_by uuid references public.crm_profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or project_id is not null or title is not null)
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete cascade,
  project_id uuid references public.crm_projects(id) on delete cascade,
  kind text not null default 'note',
  body text not null,
  created_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (lead_id is not null or project_id is not null)
);

create table if not exists public.crm_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.crm_projects(id) on delete cascade,
  concept text not null,
  amount_mxn numeric(14,2) not null check (amount_mxn > 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  created_by uuid references public.crm_profiles(id) on delete set null,
  recorded_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_form_submissions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete set null,
  form_name text not null,
  page_path text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_name text not null,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  active boolean not null default false,
  requires_human_approval boolean not null default false,
  created_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_automation_history (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.crm_automation_rules(id) on delete set null,
  lead_id uuid references public.crm_leads(id) on delete set null,
  project_id uuid references public.crm_projects(id) on delete set null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'skipped', 'waiting_approval')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists crm_leads_stage_idx on public.crm_leads(stage);
create index if not exists crm_leads_owner_idx on public.crm_leads(owner_id);
create index if not exists crm_leads_email_idx on public.crm_leads(lower(email));
create index if not exists crm_leads_next_action_idx on public.crm_leads(next_action_at) where stage not in ('won', 'lost');
create index if not exists crm_leads_created_by_idx on public.crm_leads(created_by) where created_by is not null;
create index if not exists crm_clients_lead_idx on public.crm_clients(lead_id) where lead_id is not null;
create index if not exists crm_clients_owner_idx on public.crm_clients(owner_id) where owner_id is not null;
create index if not exists crm_proposals_lead_idx on public.crm_proposals(lead_id);
create index if not exists crm_proposals_owner_idx on public.crm_proposals(owner_id);
create index if not exists crm_proposals_created_by_idx on public.crm_proposals(created_by) where created_by is not null;
create index if not exists crm_proposals_approved_by_idx on public.crm_proposals(approved_by) where approved_by is not null;
create index if not exists crm_projects_owner_status_idx on public.crm_projects(owner_id, status);
create index if not exists crm_projects_client_idx on public.crm_projects(client_id);
create index if not exists crm_projects_proposal_idx on public.crm_projects(proposal_id) where proposal_id is not null;
create index if not exists crm_projects_created_by_idx on public.crm_projects(created_by) where created_by is not null;
create index if not exists crm_tasks_assignee_due_idx on public.crm_tasks(assigned_to, due_at) where status = 'pending';
create index if not exists crm_tasks_lead_idx on public.crm_tasks(lead_id) where lead_id is not null;
create index if not exists crm_tasks_project_idx on public.crm_tasks(project_id) where project_id is not null;
create index if not exists crm_tasks_created_by_idx on public.crm_tasks(created_by) where created_by is not null;
create index if not exists crm_activities_lead_created_idx on public.crm_activities(lead_id, created_at desc);
create index if not exists crm_activities_project_created_idx on public.crm_activities(project_id, created_at desc) where project_id is not null;
create index if not exists crm_activities_created_by_idx on public.crm_activities(created_by) where created_by is not null;
create index if not exists crm_payments_due_idx on public.crm_payments(due_date) where status = 'pending';
create index if not exists crm_payments_project_idx on public.crm_payments(project_id);
create index if not exists crm_payments_created_by_idx on public.crm_payments(created_by) where created_by is not null;
create index if not exists crm_payments_recorded_by_idx on public.crm_payments(recorded_by) where recorded_by is not null;
create index if not exists crm_form_submissions_lead_idx on public.crm_form_submissions(lead_id);
create index if not exists crm_automation_rules_created_by_idx on public.crm_automation_rules(created_by) where created_by is not null;
create index if not exists crm_automation_history_rule_idx on public.crm_automation_history(rule_id) where rule_id is not null;
create index if not exists crm_automation_history_lead_idx on public.crm_automation_history(lead_id) where lead_id is not null;
create index if not exists crm_automation_history_project_idx on public.crm_automation_history(project_id) where project_id is not null;

drop trigger if exists crm_profiles_touch_updated_at on public.crm_profiles;
create trigger crm_profiles_touch_updated_at before update on public.crm_profiles for each row execute function public.vgg_crm_touch_updated_at();
drop trigger if exists crm_leads_touch_updated_at on public.crm_leads;
create trigger crm_leads_touch_updated_at before update on public.crm_leads for each row execute function public.vgg_crm_touch_updated_at();
drop trigger if exists crm_clients_touch_updated_at on public.crm_clients;
create trigger crm_clients_touch_updated_at before update on public.crm_clients for each row execute function public.vgg_crm_touch_updated_at();
drop trigger if exists crm_proposals_touch_updated_at on public.crm_proposals;
create trigger crm_proposals_touch_updated_at before update on public.crm_proposals for each row execute function public.vgg_crm_touch_updated_at();
drop trigger if exists crm_projects_touch_updated_at on public.crm_projects;
create trigger crm_projects_touch_updated_at before update on public.crm_projects for each row execute function public.vgg_crm_touch_updated_at();
drop trigger if exists crm_tasks_touch_updated_at on public.crm_tasks;
create trigger crm_tasks_touch_updated_at before update on public.crm_tasks for each row execute function public.vgg_crm_touch_updated_at();
drop trigger if exists crm_payments_touch_updated_at on public.crm_payments;
create trigger crm_payments_touch_updated_at before update on public.crm_payments for each row execute function public.vgg_crm_touch_updated_at();
drop trigger if exists crm_automation_rules_touch_updated_at on public.crm_automation_rules;
create trigger crm_automation_rules_touch_updated_at before update on public.crm_automation_rules for each row execute function public.vgg_crm_touch_updated_at();

alter table public.crm_profiles enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_clients enable row level security;
alter table public.crm_proposals enable row level security;
alter table public.crm_projects enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_payments enable row level security;
alter table public.crm_form_submissions enable row level security;
alter table public.crm_automation_rules enable row level security;
alter table public.crm_automation_history enable row level security;

revoke all on table public.crm_profiles, public.crm_leads, public.crm_clients, public.crm_proposals,
  public.crm_projects, public.crm_tasks, public.crm_activities, public.crm_payments,
  public.crm_form_submissions, public.crm_automation_rules, public.crm_automation_history
from anon, authenticated, service_role;

grant select, insert, update on table public.crm_profiles, public.crm_leads, public.crm_clients, public.crm_proposals,
  public.crm_projects, public.crm_tasks, public.crm_activities, public.crm_payments,
  public.crm_form_submissions, public.crm_automation_rules, public.crm_automation_history
to service_role;

-- Intentionally no anon/authenticated policies. All CRM data access goes through
-- the Netlify Functions permission layer. Supabase Auth remains browser-facing.

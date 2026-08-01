-- VGG-only users, embeddable forms, attribution, and lead assignment.
alter table public.crm_profiles add column if not exists team text not null default 'commercial' check (team in ('direction','commercial','production','viewer'));

create table if not exists public.crm_forms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]{2,79}$'),
  name text not null,
  description text,
  campaign text,
  service text,
  active boolean not null default false,
  allowed_domains text[] not null default '{}',
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  submit_label text not null default 'Enviar solicitud',
  success_message text not null default 'Gracias. Recibimos tu solicitud.',
  privacy_url text,
  default_owner_id uuid references public.crm_profiles(id) on delete set null,
  created_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_assignment_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  priority smallint not null default 100 check (priority between 1 and 9999),
  active boolean not null default true,
  form_id uuid references public.crm_forms(id) on delete cascade,
  service text,
  utm_source text,
  utm_campaign text,
  landing_contains text,
  assignee_id uuid not null references public.crm_profiles(id) on delete restrict,
  created_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crm_leads add column if not exists form_id uuid references public.crm_forms(id) on delete set null;
alter table public.crm_leads add column if not exists landing_url text;
alter table public.crm_leads add column if not exists referrer_url text;
alter table public.crm_leads add column if not exists utm_content text;
alter table public.crm_leads add column if not exists utm_term text;
alter table public.crm_leads add column if not exists click_id text;
alter table public.crm_leads add column if not exists assignment_rule_id uuid references public.crm_assignment_rules(id) on delete set null;

alter table public.crm_form_submissions add column if not exists form_id uuid references public.crm_forms(id) on delete restrict;
alter table public.crm_form_submissions add column if not exists visitor_id text;
alter table public.crm_form_submissions add column if not exists session_id text;
alter table public.crm_form_submissions add column if not exists page_url text;
alter table public.crm_form_submissions add column if not exists page_title text;
alter table public.crm_form_submissions add column if not exists referrer_url text;
alter table public.crm_form_submissions add column if not exists domain text;
alter table public.crm_form_submissions add column if not exists user_agent text;
alter table public.crm_form_submissions add column if not exists utm_source text;
alter table public.crm_form_submissions add column if not exists utm_medium text;
alter table public.crm_form_submissions add column if not exists utm_campaign text;
alter table public.crm_form_submissions add column if not exists utm_content text;
alter table public.crm_form_submissions add column if not exists utm_term text;

create index if not exists crm_forms_active_idx on public.crm_forms(active, slug);
create index if not exists crm_forms_default_owner_idx on public.crm_forms(default_owner_id) where default_owner_id is not null;
create index if not exists crm_forms_created_by_idx on public.crm_forms(created_by) where created_by is not null;
create index if not exists crm_assignment_rules_match_idx on public.crm_assignment_rules(active, priority, form_id);
create index if not exists crm_assignment_rules_assignee_idx on public.crm_assignment_rules(assignee_id);
create index if not exists crm_assignment_rules_created_by_idx on public.crm_assignment_rules(created_by) where created_by is not null;
create index if not exists crm_leads_form_created_idx on public.crm_leads(form_id, created_at desc) where form_id is not null;
create index if not exists crm_leads_assignment_rule_idx on public.crm_leads(assignment_rule_id) where assignment_rule_id is not null;
create index if not exists crm_form_submissions_form_created_idx on public.crm_form_submissions(form_id, created_at desc) where form_id is not null;
create index if not exists crm_form_submissions_visitor_idx on public.crm_form_submissions(visitor_id, created_at desc) where visitor_id is not null;

drop trigger if exists crm_forms_touch_updated_at on public.crm_forms;
create trigger crm_forms_touch_updated_at before update on public.crm_forms for each row execute function public.vgg_crm_touch_updated_at();
drop trigger if exists crm_assignment_rules_touch_updated_at on public.crm_assignment_rules;
create trigger crm_assignment_rules_touch_updated_at before update on public.crm_assignment_rules for each row execute function public.vgg_crm_touch_updated_at();

alter table public.crm_forms enable row level security;
alter table public.crm_assignment_rules enable row level security;
revoke all on table public.crm_forms, public.crm_assignment_rules from anon, authenticated, service_role;
grant select, insert, update on table public.crm_forms, public.crm_assignment_rules to service_role;

-- VGG-only private proposal and assisted kickoff flow.
alter table public.crm_proposals add column if not exists list_price_mxn numeric(12,2);
alter table public.crm_proposals add column if not exists discount_label text;
alter table public.crm_proposals add column if not exists discount_expires_at timestamptz;
alter table public.crm_proposals add column if not exists client_message text;
alter table public.crm_proposals add column if not exists deliverables jsonb not null default '[]'::jsonb check (jsonb_typeof(deliverables) = 'array');
alter table public.crm_proposals add column if not exists timeline jsonb not null default '[]'::jsonb check (jsonb_typeof(timeline) = 'array');
alter table public.crm_proposals add column if not exists payment_url text;
alter table public.crm_proposals add column if not exists calendar_url text;
alter table public.crm_proposals add column if not exists client_viewed_at timestamptz;
alter table public.crm_proposals add column if not exists accepted_by_name text;
alter table public.crm_proposals add column if not exists accepted_by_email text;
alter table public.crm_proposals add column if not exists rejected_at timestamptz;

alter table public.crm_proposals drop constraint if exists crm_proposals_list_price_check;
alter table public.crm_proposals add constraint crm_proposals_list_price_check
  check (list_price_mxn is null or list_price_mxn >= amount_mxn);

create unique index if not exists crm_proposals_private_token_idx
  on public.crm_proposals(private_token_hash) where private_token_hash is not null;

create table if not exists public.crm_kickoffs (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null unique references public.crm_proposals(id) on delete restrict,
  project_id uuid not null unique references public.crm_projects(id) on delete cascade,
  token_hash text not null unique,
  headline text not null,
  objectives jsonb not null default '[]'::jsonb check (jsonb_typeof(objectives) = 'array'),
  deliverables jsonb not null default '[]'::jsonb check (jsonb_typeof(deliverables) = 'array'),
  process_steps jsonb not null default '[]'::jsonb check (jsonb_typeof(process_steps) = 'array'),
  deposit_percent numeric(5,2) not null default 50 check (deposit_percent between 0 and 100),
  payment_url text,
  calendar_url text,
  start_date date,
  due_date date,
  status text not null default 'draft' check (status in ('draft','published','confirmed','completed','cancelled')),
  viewed_at timestamptz,
  confirmed_at timestamptz,
  created_by uuid references public.crm_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_projects_proposal_unique_idx
  on public.crm_projects(proposal_id) where proposal_id is not null;
create index if not exists crm_kickoffs_created_by_idx
  on public.crm_kickoffs(created_by) where created_by is not null;

drop trigger if exists crm_kickoffs_touch_updated_at on public.crm_kickoffs;
create trigger crm_kickoffs_touch_updated_at before update on public.crm_kickoffs
for each row execute function public.vgg_crm_touch_updated_at();

alter table public.crm_kickoffs enable row level security;
revoke all on table public.crm_kickoffs from anon, authenticated, service_role;
grant select, insert, update on table public.crm_kickoffs to service_role;

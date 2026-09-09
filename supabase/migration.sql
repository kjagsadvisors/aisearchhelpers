-- AI Search Helpers: leads + scans
create extension if not exists pgcrypto;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text,
  last_name text,
  phone text,
  sms_consent boolean not null default false,
  qualifier text,
  url text not null,
  domain text not null,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists leads_email_idx on leads (email);
create index if not exists leads_created_idx on leads (created_at);

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  url text not null,
  domain text not null,
  status text not null default 'queued', -- queued | running | done | error
  step text,                             -- human-readable current step
  progress int not null default 0,       -- 0-100
  report jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists scans_domain_idx on scans (domain, created_at desc);
create index if not exists scans_created_idx on scans (created_at);

-- simple rate limiting ledger
create table if not exists rate_events (
  id bigserial primary key,
  kind text not null,   -- 'ip' | 'email'
  key text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_events_idx on rate_events (kind, key, created_at);

-- lock everything down: the app uses the service-role key only
alter table leads enable row level security;
alter table scans enable row level security;
alter table rate_events enable row level security;

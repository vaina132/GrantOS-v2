-- Org-level security settings (admin-configurable)
-- Run this in your Supabase SQL Editor

create table if not exists org_security_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  mfa_required boolean not null default false,
  idle_timeout_minutes integer not null default 30,
  max_login_attempts integer not null default 6,
  lockout_duration_seconds integer not null default 60,
  password_min_length integer not null default 8,
  session_max_hours integer not null default 24,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id)
);

-- RLS
alter table org_security_settings enable row level security;

-- Members of the org can read their own security settings
create policy "Members can read own org security settings"
  on org_security_settings for select
  using (
    org_id in (
      select om.org_id from org_members om where om.user_id = auth.uid()
    )
  );

-- Only admins can update security settings
create policy "Admins can update own org security settings"
  on org_security_settings for update
  using (
    org_id in (
      select om.org_id from org_members om
      where om.user_id = auth.uid() and om.role = 'Admin'
    )
  );

-- Only admins can insert (first-time creation)
create policy "Admins can insert own org security settings"
  on org_security_settings for insert
  with check (
    org_id in (
      select om.org_id from org_members om
      where om.user_id = auth.uid() and om.role = 'Admin'
    )
  );

-- Auto-update updated_at
create or replace function update_org_security_settings_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_org_security_settings_updated
  before update on org_security_settings
  for each row
  execute function update_org_security_settings_timestamp();

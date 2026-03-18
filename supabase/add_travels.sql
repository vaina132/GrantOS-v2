-- Travel tracking per person per date
-- Run this in your Supabase SQL Editor

create table if not exists travels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  person_id uuid not null references persons(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  date date not null,
  location text not null default '',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast lookups
create index if not exists idx_travels_org_person on travels(org_id, person_id);
create index if not exists idx_travels_date on travels(org_id, date);

-- RLS
alter table travels enable row level security;

create policy "Members can read own org travels"
  on travels for select
  using (
    org_id in (
      select om.org_id from org_members om where om.user_id = auth.uid()
    )
  );

create policy "Members can insert own org travels"
  on travels for insert
  with check (
    org_id in (
      select om.org_id from org_members om where om.user_id = auth.uid()
    )
  );

create policy "Members can update own org travels"
  on travels for update
  using (
    org_id in (
      select om.org_id from org_members om where om.user_id = auth.uid()
    )
  );

create policy "Members can delete own org travels"
  on travels for delete
  using (
    org_id in (
      select om.org_id from org_members om where om.user_id = auth.uid()
    )
  );

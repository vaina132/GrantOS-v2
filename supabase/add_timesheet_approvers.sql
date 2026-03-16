-- Timesheet Approvers table
-- Mirrors the absence_approvers pattern: org-level list of people who can approve timesheets

create table if not exists public.timesheet_approvers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  department text default null,  -- NULL = org-wide approver, non-null = approves only this department
  created_at timestamptz not null default now(),

  unique(org_id, person_id, department)
);

-- RLS
alter table public.timesheet_approvers enable row level security;

create policy "Members can view their org timesheet approvers"
  on public.timesheet_approvers for select
  using (org_id in (select org_id from public.org_members where user_id = auth.uid()));

create policy "Admins can manage timesheet approvers"
  on public.timesheet_approvers for all
  using (org_id in (
    select org_id from public.org_members
    where user_id = auth.uid() and role = 'Admin'
  ));

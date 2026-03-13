# GrantLume — Feature List & System Scope

> **Last updated:** March 2026 | **Version:** 2.0
> **Stack:** React 18 + TypeScript + Vite · Supabase (PostgreSQL + Auth + RLS) · Vercel · Resend · TailwindCSS + shadcn/ui

---

## 1. What is GrantLume?

GrantLume is a **cloud-based grant project management platform** for research organisations, universities, and entities managing publicly funded projects (EU Horizon Europe, ERC, national programmes, etc.). It covers the **full grant lifecycle**: proposal tracking → project setup → personnel allocation → time tracking → absence management → financial monitoring → audit-ready reporting.

**Key differentiators:**
- Purpose-built for EU-funded research grant workflows (person-months, work packages, PM budgets)
- Multi-tenant SaaS with Row Level Security — complete data isolation per organisation
- 5 user roles + guest access with 23 granular, configurable permissions
- 25 branded transactional email templates with per-user notification preferences
- Internationalised UI (English, German, French, Spanish, Portuguese)
- GDPR-compliant by design — EU-only data storage (Frankfurt), no tracking, immutable audit trail
- AI-powered document import (Claude) for grant call parsing

---

## 2. Modules

### 2.1 Dashboard (`/dashboard`)
- Portfolio KPI cards: total projects, active staff, total budget, allocated PMs, proposal count
- Project status distribution chart (Upcoming / Active / Completed / Suspended)
- Budget overview (restricted by `canSeeFinancialDetails`)
- Global year selector (filters all modules)

### 2.2 Projects (`/projects`)
- Project list with search, status filters, sorting
- **Detail page tabs:** Overview, Allocations, Budget, Work Packages, Documents
- Fields: acronym, title, funding scheme, grant number, start/end dates, status, budget categories (Personnel/Travel/Subcontracting/Equipment/Other), overhead rate, responsible person, `has_wps`, `is_lead_organisation`, `our_pm_rate`
- Statuses: `Upcoming`, `Active`, `Completed`, `Suspended`
- File upload/download per project (Supabase Storage)
- Email on project creation (`projectCreated`)

### 2.3 Proposals (`/proposals`)
- Grant application pipeline: preparation → submission → decision
- Statuses: `In Preparation`, `Submitted`, `Rejected`, `Granted`
- Fields: name, call ID, funding scheme, deadline, budget breakdown, PM allocation, responsible person
- **Convert to Project** — one-click conversion of granted proposals
- **Export PDF** pipeline report
- Email on status change (`proposalStatusChanged`)

### 2.4 Staff (`/staff`)
- Personnel directory with search/filters
- Fields: name, email, position, department, employment type, FTE, contract dates, salary, overhead rate, country, active status, avatar, vacation days
- Salary restricted by `canSeeSalary` permission
- Deactivation with email notification (`staffDeactivated`)
- Auto-links person record to auth user by email

### 2.5 Allocations (`/allocations`) — 5 sub-tabs

**Allocation Grid:** Spreadsheet PM entry (person × project × WP × month). Add Person to Project with workload preview. Bulk Fill (right-click). Undo/Redo. Over-allocation warnings. Period lock enforcement. Absence-aware capacity. PM↔hours conversion. "Timesheets Drive Allocations" read-only mode. Email on change (`allocationChanged`).

**Personnel Overview:** Read-only matrix of each person's total allocation across projects.

**Project Overview:** Read-only matrix of each project's total PMs from all personnel.

**PM Budgets:** Planned PM budgets (from WPs) vs. actual allocated PMs.

**Period Locks:** Lock months to prevent editing (audit protection).

### 2.6 Timesheets (`/timesheets`)
- Monthly timesheet: daily hours per project
- Workflow: Draft → Submitted → Approved (or Rejected → Draft)
- Auto-calculation of totals
- Emails: `timesheetSubmitted`, `timesheetApproved`, `timesheetRejected`
- Weekly reminders (`timesheetReminder`) — Monday 9:00 UTC
- Aggregation for "Timesheets Drive Allocations" mode
- Guest users can submit

### 2.7 Absences (`/absences`)
- Types: Annual Leave, Sick Leave, Conference/Training, Parental Leave, Other
- Approval workflow via configurable Absence Approvers
- Emails: `absenceRequested`, `absenceApproved`, `absenceRejected`, `absenceCancelled`
- Approved absences auto-reduce PM capacity in Allocation Grid

### 2.8 Financials (`/financials`)
- Budget overview per project: total, spent, remaining
- Category breakdown: Personnel, Travel, Subcontracting, Equipment, Other
- Expense tracking against budget categories
- Budget alerts at 80% (`budgetAlert` email)
- PM rate calculations
- Restricted by: `canSeeFinancials`, `canSeeFinancialDetails`, `canSeePersonnelRates`

### 2.9 Timeline (`/timeline`)
- Gantt chart of all projects, color-coded by status
- Hover for details, horizontal scroll

### 2.10 Reports (`/reports`)
- PDF generation: Project Summary, Financial Report, Timesheet Report, Staff Allocations, Absence Summary, Proposals Pipeline
- Filter by project/period, on-demand download

### 2.11 Import (`/import`)
- **Spreadsheet Import** (xlsx/xls/csv): auto-detect type, auto-map columns, preview, validation
- **AI Document Parsing** (pdf/docx/png/jpg): Claude AI extracts structured data from grant calls. Ephemeral processing, not stored, not used for training

### 2.12 Audit Log (`/audit`)
- Immutable change history for all entities
- Events: create, update, delete, approve, reject, lock, unlock
- Filter by entity/action, pagination
- Cannot be deleted or modified

### 2.13 Guest Access (`/guests`)
- Invite external participants by email (`guestInvitation`)
- Levels: `contributor` (projects + timesheets), `read_only` (projects only)
- No access to financials, staff, allocations, settings

### 2.14 Settings (`/settings`) — Admin only
- **Organisation** — name, working hours/day, "Timesheets Drive Allocations" toggle
- **Users** — add/remove members, change roles (`memberRemoved` email)
- **Role Permissions** — 23 toggles per role (see §3)
- **Funding Schemes** — manage list
- **Period Locks** — lock months (`periodLocked` email)
- **Holidays** — public holidays affecting working day calculations
- **Absence Approvers** — configure approvers

### 2.15 Profile (`/profile`)
- Display name, password change
- Email notification preferences (9 toggleable types)
- Language selector (EN/DE/FR/ES/PT), persisted in localStorage

### 2.16 Help & FAQ (`/help`)
- 17 sections, 60+ FAQs, full-text search, quick-nav chips, Pro Tips, GDPR/Security docs

---

## 3. Roles & Permissions

| Role | Description |
|---|---|
| **Admin** | Full access. Cannot be restricted. |
| **Project Manager** | Projects, allocations, timesheets. No org settings/user mgmt. |
| **Finance Officer** | Financial data, salary, audit. No allocation/timesheet mgmt. |
| **Viewer** | Read-only: dashboard, projects, staff, timeline. |
| **External Participant** | Projects + own timesheets only. |

**23 permissions** in 3 categories: Module Visibility (13), Sensitive Data (3), Actions (7). All configurable per role via Settings → Role Permissions.

---

## 4. Email System (25 Templates via Resend)

`invitation`, `welcome`, `roleChanged`, `timesheetReminder`, `timesheetSubmitted`, `timesheetApproved`, `timesheetRejected`, `projectEndingSoon`, `projectCreated`, `budgetAlert`, `guestInvitation`, `trialExpiring`, `periodLocked`, `signupConfirmation`, `socialWelcome`, `emailChanged`, `passwordChanged`, `absenceRequested`, `absenceApproved`, `absenceRejected`, `absenceCancelled`, `staffDeactivated`, `allocationChanged`, `proposalStatusChanged`, `memberRemoved`

Per-user preferences: 9 toggleable notification categories.

---

## 5. i18n

- **Languages:** English, Deutsch, Français, Español, Português
- **Framework:** i18next + react-i18next + browser language detector
- **Files:** `src/locales/{en,de,fr,es,pt}.json` (360+ keys each)
- **Coverage:** All auth pages, sidebar, topbar, page headers, settings, help
- **Landing page:** Separate EN/DE inline translations

---

## 6. Authentication & Security

- Supabase Auth with PKCE email confirmation, branded via Auth Hook → Resend
- Password strength indicator, rate limiting (CAPTCHA + lockout), ephemeral sessions
- **RLS** — every query filtered by `org_id` at DB level
- **AES-256** at rest, **TLS 1.2+** in transit
- **EU-only storage** (Frankfurt, AWS eu-central-1)
- Immutable audit trail, period locking

---

## 7. GDPR & EU Compliance

- Data minimisation, purpose limitation, right to erasure/rectification/portability
- Data Protection by Design (Art. 25) — RBAC with 23 permissions
- Records of Processing (Art. 30) — immutable audit log
- Breach Notification (Art. 33) — 72h procedure
- No tracking cookies, no analytics (ePrivacy Directive)
- EU AI Act — document parsing is low-risk, ephemeral, user-reviewed
- Sub-processors: Supabase (EU), Vercel, Resend, Anthropic (ephemeral)

---

## 8. Services (`src/services/`)

`allocationsService`, `absenceService`, `absenceApproverService`, `auditService`, `auditWriter`, `avatarService`, `deliverablesService`, `documentService`, `emailService`, `expenseService`, `exportService`, `financialService`, `grantAIService`, `holidayService`, `notificationService`, `preferencesService`, `projectsService`, `proposalService`, `reportGenerator`, `reportService`, `settingsService`, `staffService`, `timesheetService`

---

## 9. Key Data Models

- `organisations` — multi-tenant root entity (name, plan, trial_ends_at, working hours)
- `org_members` — user ↔ org relationship with role
- `persons` — staff records (FTE, salary, contract dates, avatar, user_id link)
- `projects` — grant projects (acronym, budget categories, status, dates)
- `work_packages` — project sub-divisions with PM budgets
- `deliverables` — WP deliverables
- `assignments` — PM allocations (person × project × WP × month × year)
- `timesheets` / `timesheet_entries` — time tracking with approval status
- `absences` — leave records with approval workflow
- `expenses` — financial expenses against budget categories
- `proposals` — grant application pipeline
- `funding_schemes` — configurable funding programme list
- `holidays` — public holidays per org
- `period_locks` — locked months per org/year
- `absence_approvers` — who approves leave
- `role_permissions` — per-role permission overrides
- `user_preferences` — notification toggles, display name
- `notifications` — in-app notification feed
- `audit_log` — immutable change history
- `guest_links` — external access tokens
- `documents` — project file references

---

## 10. API Routes (Vercel Serverless)

- `/api/send-email` — email dispatch via Resend (25 templates)
- `/api/auth-hook` — Supabase Auth Hook for branded signup confirmation emails
- `/api/cron/timesheet-reminders` — weekly timesheet reminder cron
- `/api/cron/project-alerts` — project ending soon alerts
- `/api/cron/trial-expiring` — trial expiration reminders

---

## 11. Landing Page (`/home`)

- Marketing page with EN/DE language toggle
- Sections: Hero, Stats, Features (12 cards), How It Works (4 steps), Pricing (4 plans: Trial/Starter/Growth/Enterprise), Trust & GDPR Compliance (3 cards + 6 compliance badges), CTA, Footer
- Links to `/login`, `/signup`, `/terms`, `/privacy`

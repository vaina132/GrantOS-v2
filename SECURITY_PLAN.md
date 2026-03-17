# GrantLume Security Hardening — Implementation Plan

> Generated after a full codebase audit on 2026-03-17.
> Each section contains: audit findings → what needs to change → files to create/modify → implementation steps.

---

## Table of Contents

1. [Two-Step Login (MFA/2FA)](#1-two-step-login-mfa2fa)
2. [Auto-Logout When Idle](#2-auto-logout-when-idle)
3. [Limit Login Attempts (Server-Side)](#3-limit-login-attempts-server-side)
4. [Admin Can Require Extra Security](#4-admin-can-require-extra-security)
5. [Activity Log Expansion](#5-activity-log-expansion)
6. [Stronger Door Locks on Data (RLS + API Auth Hardening)](#6-stronger-door-locks-on-data)
7. [Software Updates Check (Dependency Scanning + Security Headers)](#7-software-updates-check)

---

## 1. Two-Step Login (MFA/2FA)

### Audit Findings

- **Current state:** Email + password only. No MFA enrollment, no TOTP, no backup codes.
- `src/stores/authStore.ts` → `signIn()` calls `supabase.auth.signInWithPassword()` directly; no MFA challenge interception.
- `src/features/auth/LoginPage.tsx` → After `signIn()` succeeds, navigates immediately to `/dashboard`. No "enter your 6-digit code" step.
- Supabase Auth supports TOTP-based MFA natively via `auth.mfa.enroll()`, `auth.mfa.challenge()`, `auth.mfa.verify()`.

### What Needs to Change

| Component | Change |
|-----------|--------|
| `authStore.ts` `signIn()` | After `signInWithPassword`, check if MFA is required (AAL2). If so, return a flag instead of navigating. |
| `LoginPage.tsx` | Add a second step: "Enter 6-digit code" form that calls `mfa.challenge()` + `mfa.verify()`. |
| New: `MfaSetupPage.tsx` | QR code enrollment page: calls `mfa.enroll({ factorType: 'totp' })`, shows QR + backup codes. |
| New: `MfaVerifyStep.tsx` | Reusable component for the 6-digit TOTP input with auto-focus on each digit. |
| `SettingsPage.tsx` | Add "Security" tab with MFA enable/disable toggle, re-enrollment, backup codes display. |

### Implementation Steps

1. **MFA enrollment page** (`src/features/auth/MfaSetupPage.tsx`)
   - Call `supabase.auth.mfa.enroll({ factorType: 'totp' })` → returns `totp.qr_code` (data URI) and `totp.secret`
   - Display QR code image + text secret for manual entry
   - Generate 10 backup codes (random 8-char alphanumeric), store hashed in `user_metadata` or a new `mfa_backup_codes` table
   - User enters TOTP code to confirm → call `mfa.challenge()` then `mfa.verify()` → if success, factor is enrolled
   - Show backup codes one-time (user must copy/download)

2. **MFA verification at login** (`src/features/auth/MfaVerifyStep.tsx`)
   - After `signInWithPassword` returns, check `data.session?.user?.factors` for enrolled TOTP factors
   - If factor exists and session is AAL1 (not AAL2), show the TOTP input step
   - Call `mfa.challenge({ factorId })` → get `challengeId`
   - User enters 6-digit code → call `mfa.verify({ factorId, challengeId, code })`
   - On success → AAL2 session established → navigate to dashboard
   - Accept backup code as alternative (check against stored hashed codes)

3. **Auth store changes** (`src/stores/authStore.ts`)
   - `signIn()` should return `{ mfaRequired: boolean; factorId?: string }` instead of void
   - New method: `verifyMfa(factorId: string, code: string): Promise<void>`
   - `loadUserContext` should check AAL level

4. **Login page changes** (`src/features/auth/LoginPage.tsx`)
   - Add state: `mfaStep: boolean`, `factorId: string`
   - If `signIn()` returns `mfaRequired: true`, show `MfaVerifyStep` instead of the login form
   - After MFA verify succeeds → navigate to dashboard

5. **Settings: Manage MFA** (`src/features/settings/SettingsPage.tsx`)
   - New "Security" tab
   - Show: "MFA Status: Enabled/Disabled"
   - Button: "Enable 2FA" → navigate to MfaSetupPage
   - Button: "Disable 2FA" → call `mfa.unenroll({ factorId })` (require current TOTP code first)
   - Button: "View backup codes" (require TOTP verification)
   - Button: "Regenerate backup codes"

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/features/auth/MfaSetupPage.tsx` | **Create** |
| `src/features/auth/MfaVerifyStep.tsx` | **Create** |
| `src/stores/authStore.ts` | **Modify** — update signIn, add verifyMfa |
| `src/features/auth/LoginPage.tsx` | **Modify** — add MFA step |
| `src/features/settings/SettingsPage.tsx` | **Modify** — add Security tab |
| `src/App.tsx` | **Modify** — add /mfa-setup route |
| `src/locales/en.json` | **Modify** — add ~25 MFA i18n keys |

### i18n Keys Needed

```
mfa.setupTitle, mfa.setupDesc, mfa.scanQrCode, mfa.manualEntry, mfa.enterCode,
mfa.verifyCode, mfa.backupCodes, mfa.backupCodesDesc, mfa.downloadCodes,
mfa.enabled, mfa.disabled, mfa.enable, mfa.disable, mfa.disableConfirm,
mfa.invalidCode, mfa.codeRequired, mfa.setupSuccess, mfa.disableSuccess,
mfa.enterBackupCode, mfa.regenerateCodes, mfa.securityTab, mfa.twoFactorAuth,
mfa.twoFactorDesc, mfa.verifyToDisable, mfa.verifyIdentity
```

---

## 2. Auto-Logout When Idle

### Audit Findings

- **Current state:** No idle timeout. Sessions persist until JWT expires (Supabase default: 1 hour, with auto-refresh).
- `src/lib/supabase.ts` has `autoRefreshToken: true, persistSession: true` — sessions live indefinitely as long as the tab is open.
- `LoginPage.tsx` has a "Remember me" checkbox that sets `gl_session_ephemeral` in sessionStorage, but there's no actual idle detection.

### What Needs to Change

| Component | Change |
|-----------|--------|
| New: `src/hooks/useIdleTimeout.ts` | Custom hook that tracks mouse/keyboard/touch events and triggers logout after N minutes of inactivity. |
| `src/components/layout/AppShell.tsx` | Wire the idle timeout hook into the main layout. |
| New: `IdleWarningDialog.tsx` | Modal that appears 2 minutes before auto-logout: "You'll be logged out in 2:00 due to inactivity." with a "Stay Logged In" button. |
| `src/locales/en.json` | Add idle timeout i18n keys. |

### Implementation Steps

1. **Create `useIdleTimeout` hook**
   - Default timeout: 30 minutes (configurable via org settings later — see #4)
   - Track events: `mousemove`, `mousedown`, `keypress`, `touchstart`, `scroll`
   - Debounce event handler (fire at most once per 30 seconds to avoid performance impact)
   - 2 minutes before timeout → show warning dialog
   - On timeout → call `signOut()` → redirect to `/login?reason=idle`
   - Reset timer on any user activity

2. **Create `IdleWarningDialog.tsx`**
   - Countdown timer showing MM:SS
   - "Stay Logged In" button → resets the idle timer
   - "Log Out Now" button → immediate signOut
   - Auto-dismisses if user interacts with the page

3. **Wire into AppShell**
   - Call `useIdleTimeout()` in `AppShell.tsx` (only when user is authenticated)
   - Skip idle timeout on certain pages (e.g., presentation mode if added later)

4. **Login page feedback**
   - If redirected with `?reason=idle`, show a toast: "You were logged out due to inactivity"

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/hooks/useIdleTimeout.ts` | **Create** |
| `src/components/common/IdleWarningDialog.tsx` | **Create** |
| `src/components/layout/AppShell.tsx` | **Modify** — wire hook |
| `src/features/auth/LoginPage.tsx` | **Modify** — handle `?reason=idle` |
| `src/locales/en.json` | **Modify** — add ~8 idle i18n keys |

---

## 3. Limit Login Attempts (Server-Side)

### Audit Findings

- **Current state:** Client-side rate limiting only in `LoginPage.tsx`:
  - `MAX_ATTEMPTS_BEFORE_CHALLENGE = 3` → shows math puzzle
  - `MAX_ATTEMPTS_BEFORE_LOCKOUT = 6` → 60-second lockout
  - State stored in `sessionStorage` — trivially bypassable by clearing storage or using a different browser/tab.
- **No server-side rate limiting on any API route.** The `/api/members`, `/api/ai`, `/api/send-email` routes have zero auth validation or rate limiting.
- Supabase Auth has built-in rate limiting on auth endpoints (default: 30 requests/hour per IP for signup, 360/hour for token).

### What Needs to Change

| Component | Change |
|-----------|--------|
| New: `api/lib/rateLimit.ts` | Shared server-side rate limiter using Vercel KV or in-memory Map with TTL. |
| `api/members.ts` | Add auth validation + rate limiting to `invite-member`, `collab-send` actions. |
| `api/ai.ts` | Add auth validation (verify JWT from Authorization header). Already has AI quota check — add auth gating. |
| `api/send-email.ts` | Add auth validation. Currently accepts any POST with a template name — **critical gap**. |
| Supabase Dashboard | Configure stricter rate limits on auth endpoints. |

### Implementation Steps

1. **Create shared rate limiter** (`api/lib/rateLimit.ts`)
   - Use in-memory `Map<string, { count: number; resetAt: number }>` (sufficient for Vercel serverless — each cold start resets, but covers burst attacks)
   - For persistent rate limiting, use Vercel KV (Redis) if available
   - Export: `rateLimit(key: string, maxRequests: number, windowSeconds: number): { allowed: boolean; remaining: number; retryAfter: number }`
   - Rate limit keys: `login:${ip}`, `invite:${orgId}`, `ai:${orgId}`, `email:${ip}`

2. **Add auth validation helper** (`api/lib/auth.ts`)
   - Extract JWT from `Authorization: Bearer <token>` header
   - Verify with Supabase: `supabase.auth.getUser(token)`
   - Return `{ user, orgId }` or throw 401
   - All API routes except `auth-hook`, `cron`, `paddle` should require valid JWT

3. **Protect each API route:**

   | Route | Auth Required | Rate Limit |
   |-------|--------------|------------|
   | `POST /api/ai?action=parse-grant` | ✅ JWT + org_id | 10 req/min per org |
   | `POST /api/ai?action=parse-collab-grant` | ✅ JWT + org_id | 10 req/min per org |
   | `POST /api/ai?action=parse-import` | ✅ JWT + org_id | 10 req/min per org |
   | `GET /api/ai?action=eu-calls` | ✅ JWT | 30 req/min per user |
   | `POST /api/members?action=invite-member` | ✅ JWT + admin role | 20 req/hour per org |
   | `POST /api/members?action=collab-send` | ✅ JWT | 20 req/hour per org |
   | `POST /api/members?action=collab-accept` | Token-based (no JWT) | 10 req/min per IP |
   | `POST /api/members?action=resolve-emails` | ✅ JWT | 30 req/min per org |
   | `POST /api/send-email` | ✅ JWT | 30 req/min per org |
   | `POST /api/auth-hook` | Hook secret (existing) | N/A (Supabase calls) |
   | `POST /api/cron` | Cron secret (existing) | N/A (Vercel Cron) |
   | `POST /api/paddle` | Webhook signature (existing) | N/A (Paddle calls) |
   | `POST /api/docusign` | ✅ JWT | 10 req/min per org |

4. **Enhance client-side login protection**
   - Keep the existing math challenge (UX deterrent), but make the lockout longer: 5 minutes after 6 failures
   - Add `lockout_until` cookie (httpOnly not available in SPA, but persistent across tabs)

### Files to Create/Modify

| File | Action |
|------|--------|
| `api/lib/rateLimit.ts` | **Create** |
| `api/lib/auth.ts` | **Create** |
| `api/ai.ts` | **Modify** — add auth + rate limit |
| `api/members.ts` | **Modify** — add auth + rate limit |
| `api/send-email.ts` | **Modify** — add auth + rate limit |
| `api/docusign.ts` | **Modify** — add auth |
| `src/features/auth/LoginPage.tsx` | **Modify** — increase lockout to 5 min |

---

## 4. Admin Can Require Extra Security

### Audit Findings

- **Current state:** `organisations` table has `plan`, `is_active`, `trial_ends_at` but **no security settings columns**.
- Role permissions are stored in `role_permissions` table (per org, per role).
- No per-org security policy (MFA requirement, idle timeout, IP restriction).

### What Needs to Change

| Component | Change |
|-----------|--------|
| DB migration | Add `security_settings JSONB` column to `organisations` table. |
| `src/types/index.ts` | Add `OrgSecuritySettings` interface. |
| `src/features/settings/SecuritySettings.tsx` | New UI: Admin-only security settings page. |
| `src/stores/orgStore.ts` | Load security settings on init. |
| `authStore.ts` / `useIdleTimeout.ts` | Respect org-level security settings. |
| `LoginPage.tsx` | Enforce MFA requirement from org settings. |

### Implementation Steps

1. **Database migration** (`supabase/add_security_settings.sql`)
   ```sql
   ALTER TABLE organisations
     ADD COLUMN IF NOT EXISTS security_settings JSONB NOT NULL DEFAULT '{
       "require_mfa": false,
       "idle_timeout_minutes": 30,
       "max_login_attempts": 6,
       "lockout_duration_minutes": 5,
       "password_min_length": 8
     }'::jsonb;
   ```

2. **TypeScript types** (`src/types/index.ts`)
   ```ts
   interface OrgSecuritySettings {
     require_mfa: boolean
     idle_timeout_minutes: number
     max_login_attempts: number
     lockout_duration_minutes: number
     password_min_length: number
   }
   ```

3. **Settings UI** (`src/features/settings/SecuritySettings.tsx`)
   - Toggle: "Require Two-Factor Authentication for all members"
   - Slider/Input: "Auto-logout after N minutes of inactivity" (5–120 min)
   - Input: "Maximum login attempts before lockout" (3–10)
   - Input: "Lockout duration" (1–60 min)
   - Input: "Minimum password length" (8–32)
   - Save button → updates `organisations.security_settings`
   - Only visible to Admin role

4. **Enforce settings**
   - `useIdleTimeout` reads `orgStore.securitySettings.idle_timeout_minutes`
   - `LoginPage` reads `orgStore.securitySettings.max_login_attempts` (fetched post-login or from a lightweight API)
   - After login, if `require_mfa` is true and user has no enrolled factors → redirect to `/mfa-setup` (forced enrollment)
   - `SignUpPage` validates `password_min_length` from org settings (for invited users, org is known from invite URL)

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/add_security_settings.sql` | **Create** |
| `src/types/index.ts` | **Modify** — add OrgSecuritySettings |
| `src/features/settings/SecuritySettings.tsx` | **Create** |
| `src/features/settings/SettingsPage.tsx` | **Modify** — add Security tab |
| `src/stores/orgStore.ts` | **Modify** — load security_settings |
| `src/hooks/useIdleTimeout.ts` | **Modify** — use org settings |
| `src/features/auth/LoginPage.tsx` | **Modify** — enforce MFA + lockout from org settings |
| `src/locales/en.json` | **Modify** — add ~15 security settings i18n keys |

---

## 5. Activity Log Expansion

### Audit Findings

- **Current state:** `writeAudit()` covers CRUD on: projects, persons, expenses, funding schemes, org settings.
- **Missing audit events:**
  - ❌ Login / logout
  - ❌ Failed login attempts
  - ❌ MFA enrollment / verification / disable
  - ❌ Permission / role changes
  - ❌ Data exports / PDF downloads
  - ❌ Invitation sent / accepted / declined
  - ❌ Org settings changes (security settings, email preferences)
  - ❌ Member added / removed
  - ❌ Collab partner invited / accepted
- `audit_log` table has: `org_id, user_id, user_email, entity_type, action, entity_id, details, created_at`
- `audit_changes` table has field-level change tracking (used by some services)
- Audit log is viewable by Admin + Finance Officer roles only (RLS policy)
- No IP address or user agent captured

### What Needs to Change

| Component | Change |
|-----------|--------|
| DB migration | Add `ip_address TEXT`, `user_agent TEXT` columns to `audit_log`. |
| `auditWriter.ts` | Add new action types: 'login', 'logout', 'login_failed', 'mfa_enroll', 'mfa_verify', 'export', 'invite'. Accept optional IP/user-agent. |
| `authStore.ts` | Write audit on login success, logout. |
| `LoginPage.tsx` | Write audit on login failure (client-initiated, fire-and-forget). |
| `UsersSettings.tsx` | Write audit on role change, member remove. |
| Report/PDF downloads | Write audit on export actions. |
| New: `AuditLogPage.tsx` or enhance existing | Full searchable/filterable audit log viewer for admins. |

### Implementation Steps

1. **Database migration** (`supabase/add_audit_columns.sql`)
   ```sql
   ALTER TABLE audit_log
     ADD COLUMN IF NOT EXISTS ip_address TEXT,
     ADD COLUMN IF NOT EXISTS user_agent TEXT;

   -- Expand the action check constraint (or remove it if not present)
   -- to include: login, logout, login_failed, mfa_enroll, mfa_verify, export, invite
   ```

2. **Expand auditWriter** (`src/services/auditWriter.ts`)
   - Add new action types to the union: `'create' | 'update' | 'delete' | 'login' | 'logout' | 'login_failed' | 'mfa_enroll' | 'mfa_verify' | 'export' | 'invite' | 'role_change' | 'settings_change'`
   - Add optional `ipAddress?: string` and `userAgent?: string` params
   - New function: `writeSecurityAudit({ orgId, action, details, ipAddress?, userAgent? })`

3. **Wire audit events into existing flows:**

   | Event | File | When |
   |-------|------|------|
   | Login success | `authStore.ts` → `signIn()` | After successful auth |
   | Login failure | `LoginPage.tsx` → `recordFailure()` | On each failed attempt |
   | Logout | `authStore.ts` → `signOut()` | Before clearing session |
   | MFA enroll | `MfaSetupPage.tsx` | After successful enrollment |
   | MFA verify | `MfaVerifyStep.tsx` | After successful 2FA |
   | Role change | `UsersSettings.tsx` | After role update |
   | Member invited | `UsersSettings.tsx` | After invite-member call |
   | Member removed | `UsersSettings.tsx` | After member deletion |
   | PDF export | `reportGenerator.ts` callers | After PDF generated |
   | Collab invite sent | `CollabProjectDetail.tsx` | After email sent |
   | Org settings changed | `settingsService.ts` | Already covered |
   | Security settings changed | `SecuritySettings.tsx` | After save |

4. **Enhanced Audit Log viewer**
   - Add filters: date range, action type, user, entity type
   - Add export to CSV
   - Show IP address + user agent for security events

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/add_audit_columns.sql` | **Create** |
| `src/services/auditWriter.ts` | **Modify** — expand action types, add IP/UA |
| `src/stores/authStore.ts` | **Modify** — audit login/logout |
| `src/features/auth/LoginPage.tsx` | **Modify** — audit failed logins |
| `src/features/settings/UsersSettings.tsx` | **Modify** — audit role changes, invites |
| Multiple report/export callers | **Modify** — audit exports |
| `src/locales/en.json` | **Modify** — add audit event labels |

---

## 6. Stronger Door Locks on Data

### Audit Findings

#### RLS Coverage — Good

All core tables have RLS enabled with `org_id = auth_org_id()` scoping:
- ✅ organisations, org_members, funding_schemes, persons, projects, work_packages, assignments, pm_budgets, timesheet_entries, absences, financial_budgets, project_documents, audit_log, audit_changes, project_guests, period_locks
- ✅ All collab tables (9 tables) with host_org + partner scoping
- ✅ notifications, proposals, project_expenses, user_preferences, deliverables, milestones, reporting_periods

#### RLS Gaps Found

| Table | Issue |
|-------|-------|
| `collab_report_events` | `INSERT` policy is `WITH CHECK (true)` — **any authenticated user can insert events into any report**. Should restrict to host org members + report's partner. |
| `collab_tasks` | Need to verify RLS exists (added in `collab_task_effort.sql`). |
| `collab_task_effort` | Need to verify RLS exists. |
| `ai_usage` / `ai_usage_log` | RLS enabled but policies use service_role — verify no client access leaks. |

#### API Auth Gaps — Critical

| Route | Issue | Severity |
|-------|-------|----------|
| `POST /api/send-email` | **No auth check at all.** Anyone can POST to this endpoint and send emails to any address using any template. | 🔴 Critical |
| `POST /api/ai` (all actions) | **No auth check.** Relies on `org_id` from request body (attacker-controlled). Could consume AI quota of any org. | 🔴 Critical |
| `POST /api/members?action=invite-member` | **No auth check.** Uses service_role key server-side but doesn't verify the caller is an admin of the specified org. | 🔴 Critical |
| `POST /api/members?action=resolve-emails` | **No auth check.** Could enumerate user IDs → emails. | 🟡 High |
| `POST /api/members?action=collab-send` | **No auth check.** | 🟡 High |
| `POST /api/members?action=collab-lookup` | **No auth check.** | 🟡 High |
| `POST /api/docusign` | **No auth check on create-envelope action.** | 🟡 High |

#### CORS — Too Permissive

All API routes set `Access-Control-Allow-Origin: *`. Should be restricted to `https://app.grantlume.com` (and localhost in dev).

### Implementation Steps

1. **Create shared auth middleware** (`api/lib/auth.ts`)
   ```ts
   export async function authenticateRequest(req: VercelRequest): Promise<{ userId: string; orgId: string; role: string }> {
     const token = req.headers.authorization?.replace('Bearer ', '')
     if (!token) throw new AuthError(401, 'Missing authorization header')

     const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
     const { data: { user }, error } = await supabase.auth.getUser(token)
     if (error || !user) throw new AuthError(401, 'Invalid or expired token')

     // Look up org membership
     const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
     const { data: member } = await adminSupabase
       .from('org_members')
       .select('org_id, role')
       .eq('user_id', user.id)
       .maybeSingle()

     if (!member) throw new AuthError(403, 'No organisation membership')

     return { userId: user.id, orgId: member.org_id, role: member.role }
   }
   ```

2. **Fix each API route** — add `authenticateRequest()` call at the top of each handler, validate that `org_id` from request body matches the JWT's org.

3. **Fix CORS** — replace `'*'` with environment-aware origin:
   ```ts
   const ALLOWED_ORIGINS = ['https://app.grantlume.com', 'http://localhost:5173']
   const origin = req.headers.origin || ''
   if (ALLOWED_ORIGINS.includes(origin)) {
     res.setHeader('Access-Control-Allow-Origin', origin)
   }
   ```

4. **Fix collab_report_events INSERT policy:**
   ```sql
   DROP POLICY IF EXISTS collab_events_insert ON collab_report_events;
   CREATE POLICY collab_events_insert ON collab_report_events
     FOR INSERT WITH CHECK (
       EXISTS (
         SELECT 1 FROM collab_reports cr
         JOIN collab_reporting_periods rp ON rp.id = cr.period_id
         WHERE cr.id = collab_report_events.report_id
           AND (is_collab_host_member(rp.project_id) OR cr.partner_id IN (
             SELECT id FROM collab_partners WHERE user_id = auth.uid() AND invite_status = 'accepted'
           ))
       )
     );
   ```

5. **Frontend: pass JWT in API calls**
   - All `fetch('/api/...')` calls need `Authorization: Bearer ${session.access_token}` header
   - Create a helper: `src/lib/apiClient.ts` that auto-attaches the token

### Files to Create/Modify

| File | Action |
|------|--------|
| `api/lib/auth.ts` | **Create** — shared auth middleware |
| `api/lib/rateLimit.ts` | **Create** — shared rate limiter (shared with #3) |
| `src/lib/apiClient.ts` | **Create** — authenticated fetch wrapper |
| `api/ai.ts` | **Modify** — add auth, fix CORS |
| `api/members.ts` | **Modify** — add auth, fix CORS |
| `api/send-email.ts` | **Modify** — add auth, fix CORS |
| `api/docusign.ts` | **Modify** — add auth, fix CORS |
| `supabase/fix_collab_events_rls.sql` | **Create** — fix INSERT policy |
| All frontend API callers | **Modify** — use apiClient with auth header |

---

## 7. Software Updates Check

### Audit Findings

- **Current state:**
  - `.github/workflows/ci.yml` runs lint + typecheck + build + unit tests. ✅
  - **No dependency scanning** — no Dependabot, no `npm audit`, no Snyk.
  - **No security headers** — `vercel.json` has only rewrites and cron schedules. No `headers` configuration.
  - No CSP (Content Security Policy).
  - No `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, etc.

### Implementation Steps

#### A. Dependency Scanning

1. **Enable GitHub Dependabot** (`.github/dependabot.yml`)
   ```yaml
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/"
       schedule:
         interval: "weekly"
       open-pull-requests-limit: 10
       labels:
         - "dependencies"
       ignore:
         - dependency-name: "*"
           update-types: ["version-update:semver-major"]
   ```

2. **Add `npm audit` to CI** (`.github/workflows/ci.yml`)
   ```yaml
   - name: Security audit
     run: npm audit --audit-level=high
     continue-on-error: true  # Don't fail the build, but report
   ```

3. **Enable GitHub security alerts** — Go to repo Settings → Code security and analysis → Enable:
   - Dependabot alerts
   - Dependabot security updates
   - Secret scanning

#### B. Security Headers

4. **Add headers to `vercel.json`:**
   ```json
   {
     "headers": [
       {
         "source": "/(.*)",
         "headers": [
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "X-Frame-Options", "value": "DENY" },
           { "key": "X-XSS-Protection", "value": "1; mode=block" },
           { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
           { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
           { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" }
         ]
       }
     ]
   }
   ```

5. **Add Content Security Policy** (in `vercel.json` or `index.html` meta tag):
   ```
   Content-Security-Policy:
     default-src 'self';
     script-src 'self' https://cdn.paddle.com;
     style-src 'self' 'unsafe-inline';
     img-src 'self' data: blob: https://*.supabase.co;
     connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://cdn.paddle.com;
     font-src 'self';
     frame-src https://checkout.paddle.com;
     frame-ancestors 'none';
     base-uri 'self';
     form-action 'self';
   ```

### Files to Create/Modify

| File | Action |
|------|--------|
| `.github/dependabot.yml` | **Create** |
| `.github/workflows/ci.yml` | **Modify** — add npm audit step |
| `vercel.json` | **Modify** — add headers array |

---

## Implementation Priority & Estimated Effort

| # | Feature | Priority | Effort | Dependencies |
|---|---------|----------|--------|-------------|
| 6 | Stronger Door Locks (API auth + RLS fixes) | 🔴 Critical | 3–4 hours | None — do first |
| 7 | Software Updates Check (headers + Dependabot) | 🔴 Critical | 30 min | None |
| 3 | Server-side Login Rate Limiting | 🟡 High | 1–2 hours | Shared with #6 (api/lib/auth.ts) |
| 1 | Two-Step Login (MFA) | 🟡 High | 4–5 hours | None |
| 5 | Activity Log Expansion | 🟡 High | 2–3 hours | None |
| 2 | Auto-Logout When Idle | 🟢 Medium | 1–2 hours | None |
| 4 | Admin Security Settings | 🟢 Medium | 2–3 hours | Depends on #1, #2, #3 |

**Recommended implementation order:** 6 → 7 → 3 → 1 → 5 → 2 → 4

**Total estimated effort:** 14–20 hours

---

## Summary of Critical Findings

> ⚠️ **The most urgent issue is #6: All API routes (`/api/ai`, `/api/members`, `/api/send-email`, `/api/docusign`) lack authentication.** Any person on the internet can call these endpoints. This should be fixed immediately.

The RLS policies on database tables are well-structured and provide good tenant isolation. The main risk surface is the API layer, which sits between the frontend and the database and currently trusts all incoming requests.

# GrantLume Feature Roadmap & Analysis

> Expert analysis of the current platform and recommended additions, with a focus on European grant management best practices and a light CRM module.

---

## Current Feature Map

| Module | What It Does |
|---|---|
| **Dashboard** | KPIs, project status chart, salary coverage, PM utilisation, AI quota |
| **Projects** | Full project lifecycle — acronym, grant number, funding programme, WPs, budgets, responsible person |
| **Collaboration** | Multi-partner EU consortium management — partners, budgets, WPs, deliverables, milestones, reporting periods, partner reports |
| **Proposals** | Pipeline tracker — In Preparation → Submitted → Granted/Rejected, convert to project |
| **Staff** | Personnel directory — FTE, salary, department, contract dates, avatar |
| **Allocations** | Person-month grid, bulk fill, matrices, PM budgets, period locks |
| **Timesheets** | Daily hour logging per project, approval workflow (Draft → Submitted → Approved), PDF export |
| **Absences** | Leave tracking with approval, capacity impact on allocations |
| **Financials** | Budget vs actuals per category (personnel, travel, subcontracting, equipment, other, indirect) |
| **Timeline** | Gantt-style read-only overview of all projects |
| **Reports** | PDF generation — project summary, financials, timesheets, staff allocations, absences, proposals |
| **Import** | Excel/CSV bulk import + AI document parsing for grant calls |
| **Audit Log** | Immutable change history for all entities |
| **Settings** | Org config, users, role permissions (23 toggles), funding schemes, holidays, period locks, approvers |
| **DocuSign** | e-Signature integration (envelope creation) |
| **Notifications** | In-app + email alerts for submissions, approvals, budget warnings, weekly reminders |

**Strengths:** Very solid core for EU grant management — person-month tracking, multi-partner collaboration, AI-powered import, proper approval workflows, and audit trail. This already covers 80% of what a Horizon Europe coordinator needs day-to-day.

---

## Recommended New Features

### Priority 1 — High Impact, Fills Clear Gaps

#### 1. Light CRM Module

**Why:** Research organisations constantly interact with funding agencies (Project Officers), reviewers, evaluators, consortium partners (beyond the current collab module), and industry contacts. There's no central place to track these relationships.

**What to build:**

| Feature | Description |
|---|---|
| **Contact Database** | Name, email, phone, organisation, role, tags, notes |
| **Organisation Directory** | Name, type (university, SME, industry, agency), country, website, past collaborations |
| **Interaction Log** | Log meetings, calls, emails with a contact — date, type, summary, linked project/proposal |
| **Tags & Categories** | Free-form tags: "Project Officer", "Reviewer", "Potential Partner", "National Contact Point" |
| **Link to Projects** | Associate contacts/orgs with projects and proposals — "Who is the PO for HORIZON-X?" |
| **Link to Proposals** | Track who you're partnering with on upcoming bids |
| **Search & Filter** | Full-text search across all contacts and organisations |
| **Import from Partners** | Auto-populate CRM entries from Collaboration partner data |

**Example use cases:**
- "Find all contacts at University of Helsinki we've worked with"
- "Who is the EC Project Officer for our MSCA project?"
- "List all SMEs we've collaborated with in the last 3 years for this new bid"
- "Log that we had a consortium kick-off call on March 15"

**Suggested DB tables:**
- `crm_contacts` (id, org_id, name, email, phone, organisation_name, role, tags[], notes, created_at)
- `crm_organisations` (id, org_id, name, type, country, website, notes, tags[], created_at)
- `crm_interactions` (id, org_id, contact_id, crm_org_id, project_id, proposal_id, type, date, summary, created_at)

---

#### 2. Document Management

**Why:** EU projects generate hundreds of documents — Grant Agreement, Consortium Agreement, amendment letters, deliverable reports, audit certificates, ethics approvals. Currently there's no document storage.

| Feature | Description |
|---|---|
| **Per-project document library** | Upload and categorise files linked to a project |
| **Categories** | Grant Agreement, Consortium Agreement, Deliverable, Report, Amendment, Ethics, Audit Certificate, Other |
| **Version tracking** | Upload new versions of the same document, keep history |
| **Shared with partners** | Mark documents as "shared" so collab partners can download them |
| **Deadline awareness** | Link documents to deliverables/milestones — "Deliverable D2.1 report due M18" |

---

#### 3. Deliverables & Milestones Tracker (for internal projects)

**Why:** The Collaboration module already has deliverables and milestones for consortium projects, but internal (single-org) projects don't. EU projects require tracking deliverable submission status.

| Feature | Description |
|---|---|
| **Deliverable list per project** | Number, title, WP, type (Report, Demonstrator, Data, Other), due month, lead partner, status |
| **Status workflow** | Not Started → In Progress → Under Review → Submitted → Accepted |
| **EC submission tracking** | Date submitted to EC portal, EC review status, EC feedback |
| **Milestone list** | Number, title, due month, verification means, status |
| **Dashboard integration** | Show upcoming deliverables in the next 30/60/90 days on the Dashboard |
| **Email reminders** | Notify responsible person X days before a deliverable is due |

---

#### 4. EU Funding Call Monitor

**Why:** The existing "EU Open Calls" AI feature could be expanded into a proper monitoring tool so users don't miss relevant calls.

| Feature | Description |
|---|---|
| **Saved searches** | Save filter criteria (topic, programme, budget range) and get notified when matching calls appear |
| **Call bookmarking** | Star calls you're interested in, add notes |
| **Link to Proposals** | Create a proposal directly from a bookmarked call, pre-filling programme and deadline |
| **Team sharing** | Share a call with colleagues within the org — "Have a look at this one" |
| **Deadline calendar** | Visual calendar view of all bookmarked call deadlines |

---

### Priority 2 — Valuable Enhancements to Existing Modules

#### 5. Enhanced Reporting & Analytics

| Feature | Description |
|---|---|
| **Dashboard widgets** | Customisable dashboard — choose which KPIs and charts to display |
| **Budget burn-down chart** | Per-project line chart showing budget consumption over time vs planned |
| **PM utilisation trends** | Month-over-month chart showing allocation vs capacity trends |
| **Export to Excel** | Export any table/grid to .xlsx (allocations, timesheets, financials, staff list) |
| **Scheduled reports** | Auto-generate and email a monthly PDF summary to stakeholders |
| **Cost statement generator** | Auto-generate Form C / Financial Statement from timesheet + salary + budget data |

---

#### 6. Work Package Management (Internal Projects)

**Why:** Internal projects currently only store basic WPs in the Collaboration module. EU projects need detailed WP management.

| Feature | Description |
|---|---|
| **WP detail page** | Description, objectives, tasks, effort table, deliverables linked |
| **Task breakdown** | Tasks within WPs with responsible person and effort allocation |
| **Effort table** | Visual effort table (persons × WPs) matching the EC Description of Action format |
| **Gantt per WP** | WP-level Gantt showing task durations |

---

#### 7. Amendment Tracking

**Why:** EU projects frequently go through amendments — budget transfers, duration extensions, partner changes. These need to be tracked formally.

| Feature | Description |
|---|---|
| **Amendment log** | Date, type (budget transfer, extension, partner change, scope change), status (requested, approved, rejected) |
| **Before/after snapshots** | Show what changed — e.g., "Budget Travel: €50,000 → €35,000" |
| **EC reference** | Store the EC amendment number and approval date |
| **Linked notifications** | Notify relevant team members when an amendment is approved |

---

#### 8. Risk Register

**Why:** EU projects (especially large ones) require a risk register as part of project management best practices and periodic reporting.

| Feature | Description |
|---|---|
| **Risk list per project** | Title, description, likelihood (Low/Medium/High), impact (Low/Medium/High), mitigation strategy |
| **Risk owner** | Assign a responsible person |
| **Status tracking** | Open → Mitigated → Closed |
| **Review reminders** | Prompt to review risks at configurable intervals (e.g., quarterly) |

---

### Priority 3 — Nice-to-Have / Future Differentiators

#### 9. Partner Evaluation & Consortium Building Tool

| Feature | Description |
|---|---|
| **Partner scorecards** | Rate past collaboration partners on delivery, communication, financial management |
| **Partner search** | Search your CRM + collab history: "Find partners with experience in AI and healthcare from Southern Europe" |
| **Consortium builder** | Visual tool to assemble a consortium for a new proposal — drag partners, see country coverage, check expertise gaps |

---

#### 10. Ethics & Compliance Tracker

| Feature | Description |
|---|---|
| **Ethics checklist** | Per-project checklist based on Horizon Europe ethics framework (human subjects, data protection, dual use, etc.) |
| **Approval tracking** | Track ethics committee approvals, informed consent documents |
| **GDPR data register** | What personal data is collected, legal basis, retention period |

---

#### 11. Communication Hub

| Feature | Description |
|---|---|
| **Project messaging** | Simple threaded discussions per project — avoids email overload |
| **Partner announcements** | Post updates visible to collab partners — "Reporting period RP2 is now open" |
| **@mentions** | Mention team members in discussions to notify them |

---

#### 12. Multi-Currency Support

| Feature | Description |
|---|---|
| **Project-level currency** | Set project currency (some national programmes use local currency, not EUR) |
| **Exchange rates** | Auto-fetch or manually set exchange rates for reporting |
| **Display preference** | Show amounts in project currency or org default |

---

## CRM Module — Detailed Design

Since this was specifically requested, here's a more detailed breakdown:

### Navigation
Add a new sidebar item **"CRM"** (or "Contacts") between Proposals and Settings, with permission `canSeeCRM`.

### Three sub-tabs

**Contacts Tab**
```
Name | Organisation | Role | Email | Tags | Last Interaction
──────────────────────────────────────────────────────────────
Dr. Maria López | TU Munich | Project Officer | m.lopez@ec.eu | [PO] [H2020] | 2 weeks ago
Prof. Jan Novak | Charles Uni | Researcher | j.novak@cuni.cz | [Partner] [AI] | 3 months ago
```

**Organisations Tab**
```
Name | Type | Country | Projects Together | Contacts
────────────────────────────────────────────────────
TU Munich | University | DE | 3 | 5
Fraunhofer IGD | Research Inst | DE | 1 | 2
```

**Interactions Tab (timeline view)**
```
📞 Call with Dr. López about HORIZON-AI-2025 kick-off — 15 Mar 2026
📧 Email to Prof. Novak re: RP1 deliverable status — 10 Mar 2026
🤝 Meeting: Consortium Assembly, Brussels — 01 Mar 2026
```

### Smart features
- **Auto-link:** When you add a collab partner, offer to create a CRM contact from the partner's contact info
- **Proposal linking:** When preparing a proposal, tag which CRM contacts/orgs are involved
- **Activity feed:** Show recent interactions on the Dashboard — "You haven't contacted TU Munich in 90 days"
- **Export:** Export contact list as vCard or CSV

---

## Implementation Priority Matrix

| # | Feature | Effort | Impact | Priority |
|---|---|---|---|---|
| 1 | **Light CRM** | Medium (2-3 weeks) | High — fills a real gap, daily use | **P1** |
| 2 | **Document Management** | Medium (2 weeks) | High — every EU project needs this | **P1** |
| 3 | **Deliverables/Milestones Tracker** | Small (1 week) | High — core EU requirement | **P1** |
| 4 | **EU Call Monitor** | Small (1 week) | Medium — builds on existing AI feature | **P1** |
| 5 | **Enhanced Reporting** | Medium (2 weeks) | High — Excel export alone is huge | **P2** |
| 6 | **WP Management** | Medium (2 weeks) | Medium — extends existing project model | **P2** |
| 7 | **Amendment Tracking** | Small (1 week) | Medium — essential for multi-year projects | **P2** |
| 8 | **Risk Register** | Small (3-5 days) | Medium — simple CRUD, high compliance value | **P2** |
| 9 | **Partner Evaluation** | Medium (2 weeks) | Medium — differentiator for heavy collaborators | **P3** |
| 10 | **Ethics Tracker** | Small (1 week) | Low-Medium — niche but important for some | **P3** |
| 11 | **Communication Hub** | Large (3-4 weeks) | Medium — competes with Slack/Teams | **P3** |
| 12 | **Multi-Currency** | Small (3-5 days) | Low — most EU projects are EUR | **P3** |

---

## Summary

GrantLume already has a **very strong foundation** — the PM allocation grid, timesheet approval, multi-partner collaboration, AI import, and proper RBAC put it ahead of most competitors in the EU grant management space.

The biggest gaps are:
1. **No relationship management** (CRM) — people lose track of contacts across projects
2. **No document storage** — forces users to maintain a separate SharePoint/Drive structure
3. **No deliverable/milestone tracking** for internal projects — this is a daily need for EU project managers
4. **No Excel export** — auditors and POs always want spreadsheets

Adding these four features would make GrantLume a **complete end-to-end EU grant management platform** — from finding calls, through proposal writing, to project execution, reporting, and audit.

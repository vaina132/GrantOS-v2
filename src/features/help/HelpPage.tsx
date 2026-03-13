import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Search,
  LayoutDashboard,
  FolderKanban,
  Lightbulb,
  Users,
  CalendarDays,
  ClipboardCheck,
  CalendarOff,
  DollarSign,
  GanttChart,
  FileText,
  Upload,
  Shield,
  UserCheck,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Rocket,
  Lock,
  Bell,
  ShieldCheck,
  KeyRound,
  UserCog,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
interface FaqItem {
  q: string
  a: string
}

interface HelpSection {
  id: string
  icon: LucideIcon
  title: string
  description: string
  content: string
  faqs: FaqItem[]
  tips?: string[]
}

// ─── Help Content ────────────────────────────────────────────

const GETTING_STARTED: HelpSection = {
  id: 'getting-started',
  icon: Rocket,
  title: 'Getting Started',
  description: 'Your first steps with GrantLume',
  content: `GrantLume is a cloud-based grant project management platform built for research organisations, universities, and any entity managing publicly funded projects. It covers the full lifecycle — from proposal tracking through project execution, personnel allocation, timesheet management, financial monitoring, and audit-ready reporting.

After signing up, you'll be guided through the onboarding wizard to set up your organisation. Here's the recommended setup order:

1. **Create your organisation** — Set your organisation name, working hours per day, and fiscal year settings.
2. **Add staff members** — Import or manually add your team with their FTE (Full-Time Equivalent), contract dates, and roles.
3. **Create projects** — Add your grant projects with start/end dates, acronyms, funding schemes, and budgets.
4. **Set up allocations** — Assign staff to projects with monthly person-month (PM) allocations.
5. **Invite team members** — Add colleagues as users with appropriate roles (Admin, Project Manager, Finance Officer, Viewer, External Participant).
6. **Configure permissions** — Fine-tune what each role can see and do in the Role Permissions settings.`,
  faqs: [
    { q: 'How do I invite team members?', a: 'Go to Settings → Users, click "Add User", enter their email and select a role. They\'ll receive a branded invitation email with a link to join your organisation.' },
    { q: 'What roles are available?', a: 'GrantLume has five roles: **Admin** (full access), **Project Manager** (manages projects and allocations), **Finance Officer** (manages budgets and financials), **Viewer** (read-only access), and **External Participant** (limited access for external collaborators). Admins can customise permissions for each role in Settings → Role Permissions.' },
    { q: 'Can I change my organisation name later?', a: 'Yes. Go to Settings → Organisation and update the name, working hours, or other settings at any time.' },
    { q: 'Is there a free trial?', a: 'Yes! GrantLume offers a 14-day free trial with full access to all features. No credit card required.' },
    { q: 'What browsers are supported?', a: 'GrantLume works in all modern browsers: Chrome, Firefox, Safari, Edge. We recommend keeping your browser updated to the latest version.' },
  ],
  tips: [
    'Start by importing your existing staff and project data using the Import module — it supports Excel/CSV files and even AI-powered document parsing.',
    'Set up your working hours per day in Settings → Organisation before creating allocations, as this affects PM ↔ hours conversions.',
  ],
}

const SECTIONS: HelpSection[] = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'Portfolio overview and KPI monitoring',
    content: `The Dashboard provides a real-time overview of your entire project portfolio for the selected year. It displays key performance indicators (KPIs), project status distribution, budget utilisation, and alerts.

**Key elements:**
- **KPI Cards** — Total projects, active staff, total budget, person-months allocated, and proposal pipeline count.
- **Project Status Distribution** — Visual chart showing how many projects are Upcoming, Active, Completed, or Suspended.
- **Budget Overview** — Aggregated budget figures across all projects (visible only to users with financial permissions).
- **Alerts** — Warnings about over-allocated staff, ending projects, or budget thresholds.
- **Year Selector** — Switch between fiscal years using the dropdown in the top-right corner. All data across every module filters to the selected year.`,
    faqs: [
      { q: 'Why can\'t I see the budget KPI?', a: 'Budget information is restricted by the **canSeeFinancialDetails** permission. Ask your Admin to enable this for your role in Settings → Role Permissions.' },
      { q: 'How do I change the displayed year?', a: 'Use the Year Selector dropdown in the top-right corner of the page (visible in the top bar). This affects all modules globally.' },
      { q: 'What does "Person-Months" mean?', a: 'A Person-Month (PM) represents one person working full-time for one month. For example, 0.5 PM means working half-time for one month. If your organisation uses 8 hours/day and a month has 22 working days, 1 PM = 176 hours.' },
    ],
  },
  {
    id: 'projects',
    icon: FolderKanban,
    title: 'Projects',
    description: 'Manage grant projects, budgets, and work packages',
    content: `The Projects module is the heart of GrantLume. Each project represents a funded grant with its own timeline, budget, personnel allocations, and work packages.

**Creating a project:**
- Set the project **acronym** (short identifier), **title**, start/end dates, status, and funding scheme.
- Optionally define a **budget** with categories: Personnel, Travel, Subcontracting, Equipment, and Other Costs.
- Add **Work Packages** (WPs) to structure the project into deliverable phases, each with its own PM budget.

**Project Detail Page:**
- **Overview tab** — Project metadata, status, key dates, and assigned team members.
- **Allocations tab** — Person-month allocations per team member per month, with utilisation bars.
- **Budget tab** — Budget breakdown by category, expense tracking, and budget vs. actual comparison (requires financial permissions).
- **Work Packages tab** — List of WPs with descriptions, responsible persons, and PM allocations.
- **Documents tab** — Upload and manage project-related files.

**Project statuses:** Upcoming, Active, Completed, Suspended.`,
    faqs: [
      { q: 'How do I add a budget to a project?', a: 'Open the project detail page, go to the Budget tab, and fill in the budget categories. You need the **canSeeFinancialDetails** permission to see and edit budgets.' },
      { q: 'Can I convert a proposal into a project?', a: 'Yes! In the Proposals module, click the "Convert to Project" button on any granted proposal. This creates a new project pre-filled with the proposal data.' },
      { q: 'What are Work Packages?', a: 'Work Packages (WPs) are sub-divisions of a project used in EU-funded grants. They allow you to break down allocations and budgets at a more granular level. WPs are optional.' },
      { q: 'How do I add team members to a project?', a: 'Go to Allocations → Allocation Grid, click "Add Person to Project", select the person and project, and start entering monthly PM values.' },
      { q: 'Can I export project data?', a: 'Yes. Use the Reports module to generate PDF reports for project summaries, budget overviews, and more.' },
    ],
    tips: [
      'Use the project acronym consistently — it appears throughout the system in allocation grids, timesheets, and reports.',
      'Set up Work Packages early if your funder requires WP-level reporting.',
    ],
  },
  {
    id: 'proposals',
    icon: Lightbulb,
    title: 'Proposals',
    description: 'Track grant applications from preparation to decision',
    content: `The Proposals module helps you manage your grant application pipeline. Track proposals from initial preparation through submission to the final funding decision.

**Proposal fields:**
- Project name, call identifier, funding scheme, submission deadline, expected decision date.
- Budget breakdown: Personnel, Travel, Subcontracting, Other.
- PM allocation (our person-months), responsible person, status, and notes.

**Statuses:** In Preparation, Submitted, Rejected, Granted.

**Key features:**
- **Status filter cards** — Click on status cards at the top to filter the proposal list.
- **Convert to Project** — When a proposal is granted, convert it directly into a project with one click.
- **Export PDF** — Generate a pipeline overview PDF for management reporting.
- **Email notifications** — When a proposal's status changes, relevant team members are notified.`,
    faqs: [
      { q: 'Can I track who is responsible for a proposal?', a: 'Yes. Each proposal has a "Responsible Person" field linked to your staff directory.' },
      { q: 'What happens when I convert a proposal to a project?', a: 'A new project is created with the proposal\'s name, funding scheme, and budget pre-filled. The proposal is marked as "Granted".' },
      { q: 'Can I export all proposals?', a: 'Yes, click the "Export PDF" button in the page header to generate a full pipeline report.' },
    ],
  },
  {
    id: 'staff',
    icon: Users,
    title: 'Staff',
    description: 'Personnel directory with contracts, FTE, and salary data',
    content: `The Staff module is your personnel directory. It stores all information needed for allocation planning and financial reporting.

**Staff fields:**
- Full name, email, position/title, department.
- **FTE** (Full-Time Equivalent) — The fraction of full-time this person works (e.g., 1.0 = full-time, 0.5 = half-time).
- Contract start/end dates, active status.
- **Salary** (annual gross) — Used for budget calculations (visible only with canSeeSalary permission).
- **Avatar** — Upload a profile photo for visual identification.

**Staff Detail Page:**
- Overview of the person's information and current project assignments.
- Allocation history across projects.
- Timesheet summary.
- Absence records.`,
    faqs: [
      { q: 'What is FTE?', a: 'FTE stands for Full-Time Equivalent. It represents the proportion of a full-time position. 1.0 FTE = full-time, 0.8 FTE = 80% time, 0.5 FTE = half-time. FTE is used to calculate maximum monthly allocation capacity.' },
      { q: 'Who can see salary data?', a: 'Only users with the **canSeeSalary** permission can view salary fields. By default, this is enabled for Admin and Finance Officer roles. It can be configured in Settings → Role Permissions.' },
      { q: 'Can I deactivate a staff member?', a: 'Yes. Edit the staff member and uncheck "Active". Deactivated staff are hidden from allocation dropdowns but their historical data is preserved. An email notification is sent when someone is deactivated.' },
      { q: 'How do I import staff from a spreadsheet?', a: 'Use the Import module. Upload an Excel or CSV file with columns for name, email, FTE, position, etc. GrantLume will map the columns automatically.' },
    ],
  },
  {
    id: 'allocations',
    icon: CalendarDays,
    title: 'Allocations',
    description: 'Person-month allocation grid, matrices, and PM budgets',
    content: `The Allocations module is where you plan and track how staff time is distributed across projects. It has five tabs:

**1. Allocation Grid**
The main spreadsheet-like interface where you enter person-month (PM) values for each person-project combination per month. Features include:
- **Add Person to Project** — Click the button below the grid to create a new allocation row.
- **Bulk Fill** — Right-click any cell to open the bulk fill dialog, which lets you set the same PM value across multiple months.
- **Undo/Redo** — Full undo/redo support while editing.
- **Over-allocation warnings** — Cells turn red when a person's total allocation exceeds their FTE capacity (accounting for absences).
- **Period locks** — Locked months are highlighted and cannot be edited.

**2. Personnel Overview (Matrix)**
A read-only matrix showing each person's total allocation across all projects for the year.

**3. Project Overview (Matrix)**
A read-only matrix showing each project's total allocated PMs from all assigned personnel.

**4. PM Budgets**
Compare planned PM budgets (from project work packages) against actual allocated PMs.

**5. Period Locks**
Lock specific months to prevent further editing — useful after a period has been audited or reported.`,
    faqs: [
      { q: 'How do I add a person to a project?', a: 'In the Allocation Grid tab, click the **"Add Person to Project"** button below the grid. Select the person and project from the dropdowns, then click Add. A new row appears in the grid where you can enter monthly PM values.' },
      { q: 'What does "Timesheets Drive Allocations" mean?', a: 'When enabled in Settings → Organisation, the allocation grid becomes read-only and PM values are automatically calculated from timesheet entries. This is useful when actual time tracking is the source of truth.' },
      { q: 'Can I allocate more than 1 PM per month?', a: 'No, 1.0 PM is the maximum per person-project per month (representing full-time on that project). However, a person can be allocated across multiple projects, and their total should not exceed their FTE.' },
      { q: 'What does the right-click Bulk Fill do?', a: 'Right-clicking a cell opens a dialog where you can set the same PM value for a range of months in one go — very useful for planning long-term allocations.' },
      { q: 'Why are some months highlighted yellow with a lock icon?', a: 'Those months have been locked via Period Locks (by an Admin). Locked periods cannot be edited to preserve audit integrity.' },
      { q: 'How are hours calculated from PMs?', a: 'Hours = PM × Working Days in Month × Hours per Day. For example: 0.5 PM in a month with 22 working days at 8h/day = 0.5 × 22 × 8 = 88 hours.' },
    ],
    tips: [
      'Use the workload preview when adding a person — it shows their current allocation across all projects with monthly capacity bars.',
      'Right-click cells for bulk filling — much faster than entering values month by month.',
      'Lock completed periods to prevent accidental changes to audited data.',
    ],
  },
  {
    id: 'timesheets',
    icon: ClipboardCheck,
    title: 'Timesheets',
    description: 'Time tracking with approval workflows',
    content: `The Timesheets module allows staff to log their working hours against projects and have them approved by managers.

**How it works:**
1. Staff members enter daily hours per project for each month.
2. When complete, they **submit** the timesheet for approval.
3. Managers/Admins **approve** or **reject** submitted timesheets.
4. Approved timesheets are locked and cannot be further edited.

**Key features:**
- **Monthly view** — One timesheet per person per month, with daily hour entries per project.
- **Status workflow** — Draft → Submitted → Approved (or Rejected back to Draft).
- **Auto-calculation** — Daily totals, monthly totals per project, and grand totals are calculated automatically.
- **Email notifications** — Submitters get notified when their timesheet is approved or rejected. Admins/PMs get notified when someone submits.
- **Weekly reminders** — Automatic email reminders are sent every Monday to staff who haven't submitted their timesheet.
- **Export** — Generate PDF timesheet reports.

**Timesheets Drive Allocations:**
When enabled in Settings, timesheet data automatically populates the allocation grid, making actual time the source of truth for PM calculations.`,
    faqs: [
      { q: 'How do I submit my timesheet?', a: 'Fill in your daily hours for the month, then click the "Submit" button. Your timesheet will be sent to your manager for approval.' },
      { q: 'What happens if my timesheet is rejected?', a: 'It returns to Draft status. You\'ll receive an email notification explaining why it was rejected. Make the necessary corrections and resubmit.' },
      { q: 'Can I edit a submitted timesheet?', a: 'No. Once submitted, it\'s locked until an Admin or Project Manager approves or rejects it. If you need changes, ask your manager to reject it first.' },
      { q: 'Do I get reminders?', a: 'Yes. GrantLume sends automatic email reminders every Monday at 9:00 UTC to staff who haven\'t submitted their timesheet for the current period.' },
      { q: 'Can guest users submit timesheets?', a: 'Yes. Guest users (external participants) can access the Timesheets module to log their hours.' },
    ],
  },
  {
    id: 'absences',
    icon: CalendarOff,
    title: 'Absences',
    description: 'Leave tracking with approval and capacity impact',
    content: `The Absences module tracks staff leave and automatically adjusts allocation capacity calculations.

**Absence types:** Annual Leave, Sick Leave, Conference/Training, Parental Leave, Other.

**How it works:**
1. Staff or managers create absence entries with dates, type, and optional notes.
2. Absences are approved by designated approvers (configured in Settings → Absence Approvers).
3. Approved absences automatically reduce the person's available capacity in the Allocation Grid.

**Capacity impact:**
When a person has an absence in a given month, their available PM capacity is reduced accordingly. For example, if someone is on leave for 5 working days in a month with 22 working days, their capacity drops by ~0.23 PM. The Allocation Grid shows this with orange-highlighted cells and adjusted capacity values.`,
    faqs: [
      { q: 'How do absences affect allocations?', a: 'Absences reduce a person\'s available PM capacity for the month. The Allocation Grid accounts for this automatically — you\'ll see orange highlights and adjusted capacity values.' },
      { q: 'Who can approve absences?', a: 'Absence approvers are configured in Settings → Absence Approvers. Typically, this is a line manager or Admin.' },
      { q: 'Can I cancel an absence?', a: 'Yes. Click the delete/cancel button on the absence entry. A notification email is sent when an absence is cancelled.' },
    ],
  },
  {
    id: 'financials',
    icon: DollarSign,
    title: 'Financials',
    description: 'Budget tracking, expenses, and financial reporting',
    content: `The Financials module provides budget monitoring across all projects.

**Features:**
- **Budget overview** — See total budget, spent amount, and remaining balance per project.
- **Category breakdown** — Personnel, Travel, Subcontracting, Equipment, and Other Costs.
- **Expense tracking** — Log individual expenses against budget categories.
- **Budget alerts** — When a category exceeds 80% utilisation, a warning email is sent to relevant stakeholders.
- **PM rate calculations** — Convert person-month allocations to monetary values using configured rates.

**Budget categories:**
| Category | Description |
|---|---|
| Personnel | Staff salary costs |
| Travel | Travel and subsistence |
| Subcontracting | External services |
| Equipment | Hardware and software |
| Other Costs | Miscellaneous expenses |

**Access control:**
Financial data is restricted by two permissions: **canSeeFinancials** (module access) and **canSeeFinancialDetails** (detailed budget data). **canSeePersonnelRates** controls visibility of PM cost rates.`,
    faqs: [
      { q: 'Who can see financial data?', a: 'Financial data requires the **canSeeFinancials** permission for module access and **canSeeFinancialDetails** for seeing actual budget numbers. By default, these are enabled for Admin and Finance Officer roles.' },
      { q: 'How do budget alerts work?', a: 'When an expense pushes a budget category above 80% utilisation, an email alert is automatically sent to users with project alert email preferences enabled.' },
      { q: 'Can I export financial reports?', a: 'Yes. Use the Reports module to generate PDF financial reports with budget breakdowns and expense summaries.' },
    ],
  },
  {
    id: 'timeline',
    icon: GanttChart,
    title: 'Timeline',
    description: 'Gantt-style visual overview of all projects',
    content: `The Timeline module provides a Gantt chart view of all your projects, showing their start dates, end dates, and current status at a glance.

**Features:**
- Visual bars representing project duration.
- Color-coded by project status (Upcoming, Active, Completed, Suspended).
- Scroll horizontally to see past and future periods.
- Hover over a project bar for detailed information.

This is useful for portfolio-level planning and identifying overlapping project periods.`,
    faqs: [
      { q: 'Can I edit projects from the timeline?', a: 'The timeline is currently a read-only view. To edit project dates, go to the Projects module and open the project detail page.' },
      { q: 'How are the bars colored?', a: 'Green = Active, Blue = Upcoming, Grey = Completed, Red = Suspended.' },
    ],
  },
  {
    id: 'reports',
    icon: FileText,
    title: 'Reports',
    description: 'Generate PDF reports for audits and management',
    content: `The Reports module generates formatted PDF reports from your data.

**Available report types:**
- **Project Summary** — Project details with personnel allocation table.
- **Financial Report** — Budget overview with expense breakdown by category.
- **Timesheet Report** — Summary by person with monthly breakdown.
- **Staff Allocations** — Allocation data in tabular format.
- **Absence Summary** — Absence records and statistics.
- **Proposals Pipeline** — All proposals with status and budget overview (also accessible from the Proposals page).

**Usage:**
Select a report type, optionally filter by project or time period, and click "Generate PDF". The report downloads immediately.`,
    faqs: [
      { q: 'Are reports suitable for EU grant audits?', a: 'Yes. Reports include all standard information required by EU funding agencies: person-months, hours worked, budget utilisation, and timesheet summaries. They are formatted for professional presentation.' },
      { q: 'Can I schedule automatic reports?', a: 'Not currently. Reports are generated on-demand. You can generate them at any time for any period.' },
    ],
  },
  {
    id: 'import',
    icon: Upload,
    title: 'Import',
    description: 'Bulk import from spreadsheets and AI-powered document parsing',
    content: `The Import module lets you bring existing data into GrantLume quickly.

**Two import methods:**

**1. Spreadsheet Import (Excel/CSV)**
Upload an Excel or CSV file and GrantLume will:
- Auto-detect the data type (persons, projects, or proposals).
- Map columns to GrantLume fields.
- Show a preview before importing.
- Validate data and report errors.

**2. AI-Powered Document Parsing**
Upload a grant call document (PDF, DOCX, or image) and GrantLume's AI will:
- Extract project information, budgets, and timelines.
- Parse structured data from unstructured documents.
- Present extracted data for review before import.

**Supported formats:** .xlsx, .xls, .csv for spreadsheets; .pdf, .docx, .png, .jpg for AI parsing.`,
    faqs: [
      { q: 'What spreadsheet columns are expected?', a: 'For persons: full_name, email, fte, position, department. For projects: acronym, title, start_date, end_date, status, funding_scheme. Column names are matched flexibly — GrantLume will try to auto-map them.' },
      { q: 'Can the AI parse any document?', a: 'The AI works best with structured grant call documents, project descriptions, and budget tables. It uses Claude AI for extraction, which handles most European grant formats well.' },
      { q: 'What happens if the import has errors?', a: 'GrantLume validates each row and shows errors inline. Valid rows can be imported while invalid ones are skipped. You can fix errors and re-import.' },
    ],
  },
  {
    id: 'audit',
    icon: Shield,
    title: 'Audit Log',
    description: 'Complete change history for compliance and accountability',
    content: `The Audit Log records every data change made in GrantLume, providing a complete trail for compliance and accountability.

**Tracked events:**
- Create, update, and delete operations on all entities (projects, staff, assignments, timesheets, absences, budgets, settings).
- Approval and rejection actions (timesheets, absences).
- Period lock/unlock operations.

**Features:**
- Filter by entity type (person, project, assignment, etc.).
- Filter by action type (create, update, delete, approve, reject, lock, unlock).
- Pagination for large audit trails.
- Timestamp, user, and detailed change description for each entry.

**Retention:** Audit records are retained for the lifetime of the organisation. They cannot be deleted or modified, ensuring audit integrity.`,
    faqs: [
      { q: 'Can audit logs be deleted?', a: 'No. Audit logs are immutable and cannot be deleted or modified. This ensures a reliable audit trail for compliance purposes.' },
      { q: 'Who can view audit logs?', a: 'Users with the **canSeeAudit** permission. By default, this is enabled for Admin and Project Manager roles.' },
      { q: 'Are audit logs exported with reports?', a: 'Currently, audit logs are viewable in the UI. Export functionality is planned for a future release.' },
    ],
  },
  {
    id: 'guests',
    icon: UserCheck,
    title: 'Guest Access',
    description: 'External collaborator access with limited permissions',
    content: `Guest Access allows you to invite external participants (e.g., project partners from other organisations) to access specific parts of GrantLume.

**Guest capabilities:**
- View project overviews.
- Submit timesheets for their allocated hours.
- Limited navigation — only the Project Overview and Timesheets modules are visible.

**How to invite a guest:**
1. Go to Guest Access page.
2. Click "Add Guest".
3. Enter the guest's email address.
4. They receive a branded invitation email with login instructions.

Guests do not have access to financial data, staff details, allocations, settings, or any administrative functions.`,
    faqs: [
      { q: 'Can guests see financial data?', a: 'No. Guests have a severely restricted view — only project overviews and their own timesheets.' },
      { q: 'How many guests can I add?', a: 'There is no limit on the number of guests. Each guest receives a separate login.' },
      { q: 'Can I revoke guest access?', a: 'Yes. Remove the guest from the Guest Access page. They will immediately lose access.' },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings',
    description: 'Organisation configuration, users, roles, and more',
    content: `The Settings module (Admin-only) contains all organisation-level configuration.

**Tabs:**
- **Organisation** — Name, working hours per day, fiscal year start, "Timesheets Drive Allocations" toggle, and other global settings.
- **Users** — Manage organisation members. Add users by email, change roles, or remove members.
- **Role Permissions** — Configure what each role can see and do. 23 individual permission toggles across module visibility, data privacy, and action permissions.
- **Funding Schemes** — Manage the list of available funding schemes (e.g., Horizon Europe, ERC, national programmes).
- **Period Locks** — Lock specific months to prevent editing of allocations and timesheets.
- **Holidays** — Configure public holidays that affect working day calculations.
- **Absence Approvers** — Set up who can approve absence requests.

**Role Permissions in detail:**
| Category | Permissions |
|---|---|
| Module Visibility | Dashboard, Projects, Staff, Allocations, Timesheets, Absences, Financials, Timeline, Reports, Import, Audit, Guests |
| Data Privacy | See Salary, See Financial Details, See Personnel Rates |
| Actions | Manage Projects, Manage Allocations, Approve Timesheets, Submit Timesheets, Manage Budgets, Generate Reports, Manage Users, Manage Organisation |`,
    faqs: [
      { q: 'Can I customise permissions per user?', a: 'Permissions are configured per role, not per user. All users with the same role share the same permissions. To give someone different permissions, assign them a different role.' },
      { q: 'What does "Working Hours per Day" affect?', a: 'It affects the PM ↔ hours conversion formula. For example, if set to 8h/day, then 1 PM in a 22-day month = 176 hours. EU projects commonly use 8h/day.' },
      { q: 'What does "Timesheets Drive Allocations" do?', a: 'When enabled, the Allocation Grid becomes read-only and PM values are automatically calculated from timesheet entries. This is ideal for organisations where actual time tracking is the primary data source.' },
    ],
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notifications & Emails',
    description: 'In-app and email notification system',
    content: `GrantLume has a comprehensive notification system to keep your team informed.

**In-app notifications:**
- Bell icon in the top bar shows unread notification count.
- Click to see recent notifications with mark-as-read and delete actions.
- Auto-polling every 30 seconds for new notifications.

**Email notifications (10 templates):**
| Template | Trigger |
|---|---|
| Invitation | New member added to organisation |
| Welcome | After completing onboarding |
| Role Changed | User's role is updated |
| Timesheet Reminder | Weekly (Monday 9:00 UTC) for unsubmitted timesheets |
| Timesheet Submitted | When a timesheet is submitted (sent to Admins/PMs) |
| Project Ending Soon | 30/14/7 days before project end date |
| Budget Alert | When a budget category exceeds 80% |
| Guest Invitation | When a guest is added |
| Trial Expiring | 7/3/1 days before trial ends |
| Period Locked | When a period is locked by an Admin |

**Managing preferences:**
Go to My Settings (click your avatar → My Settings) to toggle individual email notifications on or off.`,
    faqs: [
      { q: 'Can I turn off email notifications?', a: 'Yes. Go to My Settings → Email Notifications and toggle off the notifications you don\'t want to receive. Some critical notifications (e.g., member removed) cannot be disabled.' },
      { q: 'How often are reminder emails sent?', a: 'Timesheet reminders are sent every Monday at 9:00 UTC. Project ending alerts are checked daily at 8:00 UTC.' },
    ],
  },
  {
    id: 'profile',
    icon: UserCog,
    title: 'My Settings (Profile)',
    description: 'Personal preferences, password, and language',
    content: `Your personal settings are accessible by clicking your avatar in the top-right corner and selecting "My Settings".

**Available settings:**
- **Display Name** — Change the name shown throughout the application.
- **Password** — Update your password (minimum 8 characters).
- **Email Notifications** — Toggle individual email notification types on or off.
- **Language** — Switch the interface language between English, German, French, Spanish, and Portuguese.

Language preference is saved immediately and persists across sessions.`,
    faqs: [
      { q: 'Can I change my email address?', a: 'Email changes must be handled through Supabase authentication. Contact your organisation Admin if you need to update your email.' },
      { q: 'What languages are available?', a: 'English, Deutsch (German), Français (French), Español (Spanish), and Português (Portuguese).' },
    ],
  },
  {
    id: 'data-privacy',
    icon: Lock,
    title: 'Data Privacy & GDPR',
    description: 'How GrantLume protects your data and complies with EU regulations',
    content: `GrantLume is designed with data protection at its core, fully aligned with the EU General Data Protection Regulation (GDPR) and related European data protection legislation.

**Data Processing & Storage:**
- All data is stored in **EU-based data centres** (Frankfurt, Germany) via Supabase, running on AWS eu-central-1.
- Data is encrypted **at rest** (AES-256) and **in transit** (TLS 1.2+).
- No data is transferred outside the European Economic Area (EEA).

**GDPR Compliance Measures:**
- **Lawful Basis** — We process personal data on the basis of legitimate interest (managing employment-related project data) and consent (account creation).
- **Data Minimisation** — We only collect data necessary for grant project management: names, emails, FTE values, contract dates, and work hours.
- **Purpose Limitation** — Your data is used exclusively for project management within your organisation. We never sell, share, or use your data for advertising.
- **Right of Access (Art. 15)** — Users can view all their personal data within the application at any time.
- **Right to Rectification (Art. 16)** — Users and Admins can update any personal data through the UI.
- **Right to Erasure (Art. 17)** — Organisation Admins can delete staff members. When a user account is deleted, all associated personal data is removed. Anonymised audit records may be retained for compliance.
- **Right to Data Portability (Art. 20)** — Data can be exported via PDF reports and the Reports module.
- **Data Protection by Design (Art. 25)** — Role-based access control ensures users only see data relevant to their role. Salary data, financial details, and personnel rates are restricted by granular permissions.
- **Audit Trail (Art. 30)** — Complete, immutable audit log of all data changes for accountability and records of processing activities.
- **Breach Notification** — In the event of a data breach, we notify affected organisations within 72 hours as required by Art. 33 GDPR.
- **Sub-processors** — We use Supabase (database, auth), Vercel (hosting), and Resend (transactional email). All sub-processors are GDPR-compliant and maintain appropriate data processing agreements.

**Additional EU Compliance:**
- **ePrivacy Directive** — GrantLume uses only strictly necessary cookies/local storage (authentication tokens and language preference). No tracking cookies, no analytics, no third-party scripts.
- **EU AI Act** — The optional AI-powered import feature uses Claude AI for document parsing. Documents are processed ephemerally and not stored or used for training. Users are clearly informed when AI is being used.

**Organisational Controls:**
- Each organisation's data is isolated through Row Level Security (RLS) policies — no cross-organisation data access is possible.
- Two-factor considerations: Supabase Auth supports PKCE flow for secure email confirmation.
- Session management with configurable "Stay logged in" and automatic session cleanup.

**Data Retention:**
- Active account data is retained for the duration of the subscription.
- After account deletion, personal data is removed within 30 days.
- Anonymised audit records may be retained for up to 10 years for EU grant compliance requirements.

For more information, see our [Privacy Policy](/privacy) and [Terms of Use](/terms).`,
    faqs: [
      { q: 'Where is my data stored?', a: 'All data is stored in EU-based data centres (Frankfurt, Germany) on infrastructure operated by Supabase (AWS eu-central-1). No data leaves the EEA.' },
      { q: 'Is GrantLume GDPR compliant?', a: 'Yes. GrantLume implements all GDPR requirements including data minimisation, purpose limitation, access controls, right to erasure, data portability, breach notification procedures, and complete audit trails.' },
      { q: 'Does GrantLume use cookies?', a: 'GrantLume uses only strictly necessary local storage for authentication tokens and language preference. We do not use tracking cookies, analytics cookies, or any third-party advertising scripts.' },
      { q: 'Can I request deletion of my data?', a: 'Yes. Contact your organisation Admin to delete your account, or contact us directly at privacy@grantlume.com. All personal data will be removed within 30 days.' },
      { q: 'Who are your sub-processors?', a: 'Supabase (database & authentication, EU data centre), Vercel (application hosting, edge network), and Resend (transactional email delivery). All maintain GDPR-compliant data processing agreements.' },
      { q: 'How is AI used in GrantLume?', a: 'AI is only used in the optional Import module for document parsing. Documents are processed ephemerally by Anthropic\'s Claude AI, are not stored, and are not used for model training. Users are clearly informed before any AI processing occurs.' },
      { q: 'What happens if there is a data breach?', a: 'We follow GDPR Art. 33 procedures: the supervisory authority is notified within 72 hours, and affected organisations are informed without undue delay with details of the breach, its impact, and remediation steps.' },
      { q: 'Does GrantLume comply with the EU AI Act?', a: 'Yes. GrantLume\'s AI features are limited to document parsing (low-risk). We provide transparency about AI usage, allow users to review AI outputs before import, and do not make automated decisions affecting individuals.' },
    ],
    tips: [
      'Review the Role Permissions settings to ensure data access follows the principle of least privilege.',
      'Use Period Locks to protect audited data from accidental modification.',
      'Regularly review the Audit Log for compliance monitoring.',
    ],
  },
  {
    id: 'security',
    icon: ShieldCheck,
    title: 'Security',
    description: 'Authentication, access control, and data protection measures',
    content: `GrantLume implements multiple layers of security to protect your data.

**Authentication:**
- Secure email/password authentication via Supabase Auth.
- PKCE (Proof Key for Code Exchange) flow for email confirmation — the most secure OAuth pattern.
- Password strength enforcement (minimum 8 characters with strength indicator).
- Rate limiting: after 3 failed login attempts, a CAPTCHA-style math challenge is shown. After 6 attempts, a 60-second lockout is enforced.
- "Stay logged in" option with automatic session cleanup for shared devices.
- Password reset via secure, time-limited email links.

**Access Control:**
- **Row Level Security (RLS)** — Every database query is filtered by organisation ID at the database level. Users can never access data from another organisation, even through direct API calls.
- **Role-Based Access Control (RBAC)** — 5 roles with 23 configurable permissions controlling module visibility, data privacy, and action capabilities.
- **Guest isolation** — External participants see only project overviews and their own timesheets.

**Infrastructure Security:**
- All traffic encrypted via TLS 1.2+.
- Database encrypted at rest (AES-256).
- Hosted on Vercel's edge network with automatic DDoS protection.
- Database on Supabase (AWS) with automated backups.
- No sensitive data in client-side storage beyond session tokens.

**Operational Security:**
- Immutable audit trail for all data changes.
- Period locking to protect historical data.
- Email notifications for security-relevant events (role changes, member removal).`,
    faqs: [
      { q: 'Is my password stored securely?', a: 'Passwords are hashed using bcrypt before storage. GrantLume never stores or has access to your plaintext password.' },
      { q: 'Can someone from another organisation see my data?', a: 'No. Row Level Security (RLS) policies ensure complete data isolation between organisations at the database level.' },
      { q: 'What happens if I forget my password?', a: 'Click "Trouble logging in?" on the login page. A secure, time-limited password reset link will be sent to your email.' },
      { q: 'Is there two-factor authentication?', a: 'GrantLume uses PKCE flow for email verification and rate limiting for login protection. Full TOTP-based 2FA is planned for a future release.' },
    ],
  },
  {
    id: 'keyboard-tips',
    icon: KeyRound,
    title: 'Tips & Best Practices',
    description: 'Power-user tips for efficient workflow',
    content: `**Workflow Best Practices:**

**For Admins:**
- Set up Role Permissions early — especially restricting salary and financial data to appropriate roles.
- Configure Period Locks after each reporting period to protect audited data.
- Review the Audit Log regularly for compliance.
- Set up Absence Approvers so leave requests are routed correctly.

**For Project Managers:**
- Use the Allocation Grid's bulk fill (right-click) to quickly plan allocations for multiple months.
- Check the Personnel Overview matrix regularly to spot over-allocated team members.
- Set up Work Packages early if your funder requires WP-level reporting.
- Use the Proposals module to track your pipeline and convert granted proposals to projects in one click.

**For All Users:**
- Use the Year Selector to switch between fiscal years — it filters all data globally.
- Check your email notification preferences in My Settings to control which alerts you receive.
- Switch the interface language in My Settings if you prefer working in German, French, Spanish, or Portuguese.
- Use the Import module for bulk data entry — it's much faster than manual entry.
- The Timeline view is great for getting a quick overview of project schedules.

**Data Entry Tips:**
- In the Allocation Grid, hover over a cell to see the person's capacity and absence information.
- Right-click cells in the allocation grid to bulk-fill multiple months at once.
- Use keyboard Tab/Shift+Tab to navigate between cells in the allocation grid.
- PM values support two decimal places (e.g., 0.25, 0.50, 0.75, 1.00).`,
    faqs: [
      { q: 'What is the fastest way to enter allocations?', a: 'Right-click any cell in the Allocation Grid and use Bulk Fill to set the same PM value across multiple months. You can also use Tab to navigate between cells quickly.' },
      { q: 'Can I undo changes?', a: 'Yes. In the Allocation Grid, use the Undo/Redo buttons (or the data will be preserved until you click Save). Unsaved changes are indicated by a badge.' },
    ],
  },
]

// ─── Component ───────────────────────────────────────────────

function AccordionItem({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b last:border-0">
      <button
        onClick={onToggle}
        className="flex items-start justify-between w-full py-3 text-left text-sm font-medium hover:text-primary transition-colors gap-2"
      >
        <span>{item.q}</span>
        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div
          className="pb-3 text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: item.a.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
        />
      )}
    </div>
  )
}

function SectionPanel({ section, searchQuery }: { section: HelpSection; searchQuery: string }) {
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState(!!searchQuery)

  const toggleFaq = (index: number) => {
    setOpenFaqs((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  // Auto-expand if search matches
  const matchesSearch = searchQuery
    ? section.title.toLowerCase().includes(searchQuery) ||
      section.description.toLowerCase().includes(searchQuery) ||
      section.content.toLowerCase().includes(searchQuery) ||
      section.faqs.some((f) => f.q.toLowerCase().includes(searchQuery) || f.a.toLowerCase().includes(searchQuery))
    : true

  if (!matchesSearch) return null

  const Icon = section.icon

  return (
    <Card id={section.id} className="scroll-mt-24">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          expanded ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base">{section.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
        </div>
        {expanded ? <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <CardContent className="pt-0 pb-5 px-5 space-y-6">
          {/* Content */}
          <div
            className="prose prose-sm max-w-none dark:prose-invert text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: section.content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n- /g, '<br/>• ')
                .replace(/\n(\d+)\. /g, '<br/>$1. ')
                .replace(/\|(.*?)\|/g, (_, row) => {
                  const cells = row.split('|').map((c: string) => c.trim()).filter(Boolean)
                  return `<tr>${cells.map((c: string) => `<td class="border px-2 py-1 text-xs">${c}</td>`).join('')}</tr>`
                })
            }}
          />

          {/* Tips */}
          {section.tips && section.tips.length > 0 && (
            <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-200">
                <Rocket className="h-4 w-4" />
                Pro Tips
              </div>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1.5">
                {section.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* FAQs */}
          {section.faqs.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                Frequently Asked Questions
              </h4>
              <div className="rounded-lg border divide-y">
                <div className="px-4">
                  {section.faqs.map((faq, i) => (
                    <AccordionItem
                      key={i}
                      item={faq}
                      isOpen={openFaqs.has(i) || (!!searchQuery && (faq.q.toLowerCase().includes(searchQuery) || faq.a.toLowerCase().includes(searchQuery)))}
                      onToggle={() => toggleFaq(i)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function HelpPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const searchLower = search.toLowerCase().trim()

  const allSections = [GETTING_STARTED, ...SECTIONS]

  const totalFaqs = allSections.reduce((sum, s) => sum + s.faqs.length, 0)

  // Quick-nav categories
  const categories = [
    { label: 'Getting Started', icon: Rocket, ids: ['getting-started'] },
    { label: 'Core Modules', icon: FolderKanban, ids: ['dashboard', 'projects', 'proposals', 'staff'] },
    { label: 'Operations', icon: CalendarDays, ids: ['allocations', 'timesheets', 'absences', 'financials', 'timeline'] },
    { label: 'Administration', icon: Settings, ids: ['reports', 'import', 'audit', 'guests', 'settings'] },
    { label: 'Account & Notifications', icon: Bell, ids: ['notifications', 'profile'] },
    { label: 'Security & Compliance', icon: Lock, ids: ['data-privacy', 'security'] },
    { label: 'Tips & Best Practices', icon: KeyRound, ids: ['keyboard-tips'] },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.help')}
        description="Everything you need to know about GrantLume"
      />

      {/* Hero */}
      <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border p-6 sm:p-8">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <h2 className="text-2xl font-bold">Help Centre</h2>
          </div>
          <p className="text-muted-foreground">
            {allSections.length} topics · {totalFaqs} FAQs · Covering every feature in GrantLume
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search help articles & FAQs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
        </div>
      </div>

      {/* Quick Nav */}
      {!searchLower && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const CatIcon = cat.icon
            return (
              <button
                key={cat.label}
                onClick={() => {
                  const el = document.getElementById(cat.ids[0])
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 hover:bg-muted px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <CatIcon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {allSections.map((section) => (
          <SectionPanel key={section.id} section={section} searchQuery={searchLower} />
        ))}
      </div>

      {/* Footer */}
      <div className="rounded-lg border bg-muted/30 p-6 text-center space-y-2">
        <p className="text-sm font-medium">Still have questions?</p>
        <p className="text-sm text-muted-foreground">
          Contact us at <a href="mailto:support@grantlume.com" className="text-primary hover:underline font-medium">support@grantlume.com</a> — we typically respond within 24 hours.
        </p>
      </div>
    </div>
  )
}

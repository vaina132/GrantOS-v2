/**
 * Email HTML templates for GrantLume
 * Each function returns { subject, html } for use with Resend
 */

const BRAND_COLOR = '#2563eb'
const MUTED_COLOR = '#6b7280'
const BG_COLOR = '#f9fafb'
const CARD_BG = '#ffffff'

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG_COLOR};padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${CARD_BG};border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
<!-- Header -->
<tr><td style="background:${BRAND_COLOR};padding:24px 32px;">
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="background:white;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
      <span style="font-size:18px;font-weight:700;color:${BRAND_COLOR};line-height:36px;">G</span>
    </td>
    <td style="padding-left:12px;color:white;font-size:18px;font-weight:600;">GrantLume</td>
  </tr></table>
</td></tr>
<!-- Body -->
<tr><td style="padding:32px;">${body}</td></tr>
<!-- Footer -->
<tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
  <p style="margin:0 0 8px;font-size:12px;color:${MUTED_COLOR};text-align:center;">
    This is an automated message from GrantLume. Please do not reply directly to this email.
  </p>
  <p style="margin:0;font-size:11px;color:${MUTED_COLOR};text-align:center;">
    <a href="https://app.grantlume.com/profile" style="color:${BRAND_COLOR};text-decoration:underline;">Manage your notification preferences</a>
  </p>
</td></tr>
</table>
</td></tr></table>
</body></html>`
}

function button(text: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td>
<a href="${href}" style="display:inline-block;background:${BRAND_COLOR};color:white;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">${text}</a>
</td></tr></table>`
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">${text}</h1>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">${text}</p>`
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;font-size:13px;color:${MUTED_COLOR};border-bottom:1px solid #f3f4f6;">${label}</td>
    <td style="padding:8px 12px;font-size:13px;font-weight:500;color:#111827;border-bottom:1px solid #f3f4f6;">${value}</td>
  </tr>`
}

function detailTable(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
${rows}
</table>`
}

// ─── Templates ───────────────────────────────────────────

export interface EmailTemplate {
  subject: string
  html: string
}

/** User invited to join an organisation */
export function invitationEmail(params: {
  invitedEmail: string
  orgName: string
  role: string
  invitedByName: string
  signUpUrl: string
}): EmailTemplate {
  return {
    subject: `You've been invited to join ${params.orgName} on GrantLume`,
    html: layout('Invitation', [
      heading('You\'re invited!'),
      paragraph(`<strong>${params.invitedByName}</strong> has invited you to join <strong>${params.orgName}</strong> on GrantLume as a <strong>${params.role}</strong>.`),
      paragraph('GrantLume helps research teams manage grant projects, allocations, timesheets, and budgets in one place.'),
      detailTable(
        detailRow('Organisation', params.orgName) +
        detailRow('Your Role', params.role) +
        detailRow('Invited By', params.invitedByName)
      ),
      button('Accept Invitation', params.signUpUrl),
      paragraph(`If you weren't expecting this invitation, you can safely ignore this email.`),
    ].join('')),
  }
}

/** Welcome email after signup */
export function welcomeEmail(params: {
  userName: string
  orgName: string
  dashboardUrl: string
}): EmailTemplate {
  return {
    subject: `Welcome to GrantLume — ${params.orgName}`,
    html: layout('Welcome', [
      heading(`Welcome, ${params.userName}!`),
      paragraph(`Your account for <strong>${params.orgName}</strong> is all set up. You can now start managing your grant projects, allocations, and timesheets.`),
      paragraph('Here are a few things you can do to get started:'),
      `<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.8;color:#374151;">
        <li>Add your first project</li>
        <li>Invite team members</li>
        <li>Set up funding schemes</li>
        <li>Configure person-month allocations</li>
      </ul>`,
      button('Go to Dashboard', params.dashboardUrl),
    ].join('')),
  }
}

/** Role changed notification */
export function roleChangedEmail(params: {
  userName: string
  orgName: string
  oldRole: string
  newRole: string
  dashboardUrl: string
}): EmailTemplate {
  return {
    subject: `Your role in ${params.orgName} has been updated`,
    html: layout('Role Updated', [
      heading('Role Updated'),
      paragraph(`Hi ${params.userName}, your role in <strong>${params.orgName}</strong> has been changed.`),
      detailTable(
        detailRow('Previous Role', params.oldRole) +
        detailRow('New Role', `<strong>${params.newRole}</strong>`)
      ),
      paragraph('Your accessible modules and permissions may have changed. If you have questions, please contact your administrator.'),
      button('Go to Dashboard', params.dashboardUrl),
    ].join('')),
  }
}

/** Timesheet submission reminder */
export function timesheetReminderEmail(params: {
  userName: string
  orgName: string
  period: string
  timesheetUrl: string
}): EmailTemplate {
  return {
    subject: `Timesheet reminder — ${params.period}`,
    html: layout('Timesheet Reminder', [
      heading('Timesheet Reminder'),
      paragraph(`Hi ${params.userName}, this is a friendly reminder to submit your timesheet for <strong>${params.period}</strong> in <strong>${params.orgName}</strong>.`),
      paragraph('Please log your hours and submit before the deadline.'),
      button('Open Timesheets', params.timesheetUrl),
    ].join('')),
  }
}

/** Timesheet submitted — notify approver */
export function timesheetSubmittedEmail(params: {
  approverName: string
  submitterName: string
  orgName: string
  period: string
  timesheetUrl: string
}): EmailTemplate {
  return {
    subject: `Timesheet submitted by ${params.submitterName} — ${params.period}`,
    html: layout('Timesheet Submitted', [
      heading('Timesheet Submitted'),
      paragraph(`Hi ${params.approverName}, <strong>${params.submitterName}</strong> has submitted their timesheet for <strong>${params.period}</strong>.`),
      paragraph('Please review and approve or request changes.'),
      button('Review Timesheet', params.timesheetUrl),
    ].join('')),
  }
}

/** Project ending soon */
export function projectEndingSoonEmail(params: {
  recipientName: string
  orgName: string
  projectAcronym: string
  projectTitle: string
  endDate: string
  daysRemaining: number
  projectUrl: string
}): EmailTemplate {
  return {
    subject: `Project "${params.projectAcronym}" ending in ${params.daysRemaining} days`,
    html: layout('Project Alert', [
      heading('Project Ending Soon'),
      paragraph(`Hi ${params.recipientName}, the following project in <strong>${params.orgName}</strong> is ending soon.`),
      detailTable(
        detailRow('Project', `${params.projectAcronym} — ${params.projectTitle}`) +
        detailRow('End Date', params.endDate) +
        detailRow('Days Remaining', `<strong>${params.daysRemaining}</strong>`)
      ),
      paragraph('Please ensure all deliverables and reports are in order.'),
      button('View Project', params.projectUrl),
    ].join('')),
  }
}

/** Budget threshold exceeded */
export function budgetAlertEmail(params: {
  recipientName: string
  orgName: string
  projectAcronym: string
  budgetCategory: string
  percentUsed: number
  projectUrl: string
}): EmailTemplate {
  const severity = params.percentUsed >= 100 ? 'exceeded' : `reached ${params.percentUsed}%`
  return {
    subject: `Budget alert: ${params.projectAcronym} ${params.budgetCategory} ${severity}`,
    html: layout('Budget Alert', [
      heading('Budget Alert'),
      paragraph(`Hi ${params.recipientName}, a budget threshold has been ${severity} in <strong>${params.orgName}</strong>.`),
      detailTable(
        detailRow('Project', params.projectAcronym) +
        detailRow('Category', params.budgetCategory) +
        detailRow('Usage', `<strong style="color:${params.percentUsed >= 100 ? '#dc2626' : '#d97706'}">${params.percentUsed}%</strong>`)
      ),
      paragraph('Please review the budget and take appropriate action.'),
      button('View Project', params.projectUrl),
    ].join('')),
  }
}

/** Guest invitation */
export function guestInvitationEmail(params: {
  guestEmail: string
  orgName: string
  projectAcronym: string
  invitedByName: string
  accessLevel: string
  loginUrl: string
}): EmailTemplate {
  return {
    subject: `You've been given guest access to ${params.projectAcronym} on GrantLume`,
    html: layout('Guest Invitation', [
      heading('Guest Access Granted'),
      paragraph(`<strong>${params.invitedByName}</strong> has given you guest access to the project <strong>${params.projectAcronym}</strong> in <strong>${params.orgName}</strong>.`),
      detailTable(
        detailRow('Project', params.projectAcronym) +
        detailRow('Access Level', params.accessLevel) +
        detailRow('Organisation', params.orgName)
      ),
      button('Access Project', params.loginUrl),
      paragraph('If you weren\'t expecting this, you can safely ignore this email.'),
    ].join('')),
  }
}

/** Trial expiring */
export function trialExpiringEmail(params: {
  userName: string
  orgName: string
  daysRemaining: number
  upgradeUrl: string
}): EmailTemplate {
  return {
    subject: `Your GrantLume trial expires in ${params.daysRemaining} day${params.daysRemaining === 1 ? '' : 's'}`,
    html: layout('Trial Expiring', [
      heading('Trial Expiring Soon'),
      paragraph(`Hi ${params.userName}, your free trial for <strong>${params.orgName}</strong> on GrantLume expires in <strong>${params.daysRemaining} day${params.daysRemaining === 1 ? '' : 's'}</strong>.`),
      paragraph('Upgrade now to keep your data and continue using all features without interruption.'),
      button('Upgrade Now', params.upgradeUrl),
      paragraph('If you have questions about pricing or features, don\'t hesitate to reach out to our support team.'),
    ].join('')),
  }
}

/** Period locked notification */
export function periodLockedEmail(params: {
  recipientName: string
  orgName: string
  period: string
  lockedBy: string
}): EmailTemplate {
  return {
    subject: `Period "${params.period}" has been locked — ${params.orgName}`,
    html: layout('Period Locked', [
      heading('Period Locked'),
      paragraph(`Hi ${params.recipientName}, the period <strong>${params.period}</strong> in <strong>${params.orgName}</strong> has been locked by <strong>${params.lockedBy}</strong>.`),
      paragraph('No further edits can be made to timesheets or allocations for this period. Contact your administrator if you need changes.'),
    ].join('')),
  }
}

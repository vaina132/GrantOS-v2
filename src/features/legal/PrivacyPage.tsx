import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            G
          </div>
          <span className="text-xl font-bold tracking-tight">GrantLume</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: March 11, 2026</p>

        <div className="prose prose-sm prose-gray dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Introduction</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              GrantLume Ltd. ("we", "us", "our") is committed to protecting your privacy. This Privacy
              Policy explains how we collect, use, store, and share your personal data when you use
              the GrantLume platform ("the Service") accessible at app.grantlume.com. We act as both
              a data controller (for account data) and a data processor (for organisation data entered
              by our customers) under the General Data Protection Regulation (GDPR).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Data Controller</h2>
            <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground">GrantLume Ltd.</p>
              <p>Email: privacy@grantlume.com</p>
              <p>Website: www.grantlume.com</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. What Data We Collect</h2>

            <h3 className="text-base font-medium mt-4 mb-2">3.1 Account Data (provided by you)</h3>
            <ul className="text-sm leading-relaxed text-muted-foreground ml-4 space-y-1 list-disc">
              <li>First name and last name</li>
              <li>Email address</li>
              <li>Password (stored in hashed form only)</li>
              <li>Organisation name and details</li>
              <li>Role within the organisation</li>
              <li>Profile preferences and notification settings</li>
            </ul>

            <h3 className="text-base font-medium mt-4 mb-2">3.2 Organisation Data (entered by your organisation)</h3>
            <ul className="text-sm leading-relaxed text-muted-foreground ml-4 space-y-1 list-disc">
              <li>Project information (titles, acronyms, budgets, timelines)</li>
              <li>Staff/personnel records (names, employment details, salary data)</li>
              <li>Time tracking and allocation data</li>
              <li>Absence records</li>
              <li>Financial records (budgets, expenses, actuals)</li>
              <li>Documents uploaded to the platform</li>
            </ul>

            <h3 className="text-base font-medium mt-4 mb-2">3.3 Technical Data (collected automatically)</h3>
            <ul className="text-sm leading-relaxed text-muted-foreground ml-4 space-y-1 list-disc">
              <li>IP address</li>
              <li>Browser type and version</li>
              <li>Operating system</li>
              <li>Pages visited and features used</li>
              <li>Timestamps of access</li>
              <li>Referring URL</li>
            </ul>

            <h3 className="text-base font-medium mt-4 mb-2">3.4 Third-Party Authentication Data</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              If you sign in using Google, Microsoft, or Slack, we receive your name, email address,
              and profile picture (if available) from those providers. We do not receive or store
              your passwords from third-party providers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. How We Use Your Data</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">We use your data for the following purposes:</p>
            <ul className="text-sm leading-relaxed text-muted-foreground mt-2 ml-4 space-y-1 list-disc">
              <li><strong>Service provision</strong> — To create and manage your account, authenticate you, and provide the core functionality of the platform</li>
              <li><strong>Communication</strong> — To send transactional emails (account confirmation, password resets, invitation notifications, timesheet reminders, project alerts)</li>
              <li><strong>Improvement</strong> — To analyse usage patterns and improve the Service (using aggregated, anonymised data only)</li>
              <li><strong>Security</strong> — To detect and prevent fraud, abuse, and security incidents</li>
              <li><strong>Legal compliance</strong> — To comply with applicable laws and regulations</li>
              <li><strong>Support</strong> — To respond to your requests and provide customer support</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Legal Basis for Processing (GDPR)</h2>
            <ul className="text-sm leading-relaxed text-muted-foreground ml-4 space-y-2 list-disc">
              <li><strong>Contract performance (Art. 6(1)(b) GDPR)</strong> — Processing necessary to provide the Service as agreed in our Terms of Use</li>
              <li><strong>Legitimate interest (Art. 6(1)(f) GDPR)</strong> — Processing for security, fraud prevention, and service improvement</li>
              <li><strong>Consent (Art. 6(1)(a) GDPR)</strong> — Where you have opted in to receive marketing communications or use optional features</li>
              <li><strong>Legal obligation (Art. 6(1)(c) GDPR)</strong> — Where processing is required to comply with applicable law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Data Sharing</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We do not sell your personal data. We share data only with the following categories of recipients:
            </p>
            <ul className="text-sm leading-relaxed text-muted-foreground mt-2 ml-4 space-y-2 list-disc">
              <li><strong>Infrastructure providers</strong> — Supabase (database and authentication, EU-hosted), Vercel (application hosting)</li>
              <li><strong>Email service</strong> — Resend (transactional email delivery)</li>
              <li><strong>Authentication providers</strong> — Google, Microsoft, Slack (only if you choose to sign in via these providers)</li>
              <li><strong>Organisation members</strong> — Data you enter is visible to other authorised members of your organisation, subject to role-based access controls</li>
              <li><strong>Guest collaborators</strong> — Limited project data may be shared with external guests invited by your organisation</li>
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground mt-2">
              All third-party service providers are contractually obligated to process data only on our
              behalf and in accordance with applicable data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Data Storage and Security</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your data is stored on secure servers within the European Union (EU). We implement
              appropriate technical and organisational measures including:
            </p>
            <ul className="text-sm leading-relaxed text-muted-foreground mt-2 ml-4 space-y-1 list-disc">
              <li>Encryption in transit (TLS 1.2+) and at rest (AES-256)</li>
              <li>Row-Level Security (RLS) ensuring data isolation between organisations</li>
              <li>Role-based access controls within each organisation</li>
              <li>Regular security audits and dependency updates</li>
              <li>Secure password hashing (bcrypt via Supabase Auth)</li>
              <li>Automated backups with point-in-time recovery</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Data Retention</h2>
            <ul className="text-sm leading-relaxed text-muted-foreground ml-4 space-y-2 list-disc">
              <li><strong>Active accounts</strong> — Data is retained for as long as your account is active</li>
              <li><strong>After account termination</strong> — Data is retained for 30 days to allow for data export, then permanently deleted</li>
              <li><strong>After trial expiration</strong> — Data is retained for 30 days, then permanently deleted unless you subscribe</li>
              <li><strong>Backups</strong> — Backups are retained for up to 90 days and are then automatically purged</li>
              <li><strong>Legal obligations</strong> — Some data may be retained longer if required by law (e.g., financial records for tax purposes)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Your Rights (GDPR)</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Under the GDPR, you have the following rights:
            </p>
            <ul className="text-sm leading-relaxed text-muted-foreground mt-2 ml-4 space-y-2 list-disc">
              <li><strong>Right of access (Art. 15)</strong> — Request a copy of your personal data</li>
              <li><strong>Right to rectification (Art. 16)</strong> — Request correction of inaccurate data</li>
              <li><strong>Right to erasure (Art. 17)</strong> — Request deletion of your personal data ("right to be forgotten")</li>
              <li><strong>Right to restriction (Art. 18)</strong> — Request restriction of processing in certain circumstances</li>
              <li><strong>Right to data portability (Art. 20)</strong> — Receive your data in a structured, machine-readable format</li>
              <li><strong>Right to object (Art. 21)</strong> — Object to processing based on legitimate interests</li>
              <li><strong>Right to withdraw consent (Art. 7(3))</strong> — Withdraw consent at any time where processing is based on consent</li>
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground mt-2">
              To exercise any of these rights, contact us at privacy@grantlume.com. We will respond
              within 30 days. You also have the right to lodge a complaint with your local data
              protection authority.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Cookies and Tracking</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We use only essential cookies required for authentication and session management.
              We do not use advertising cookies or third-party tracking pixels. Session tokens
              are stored securely in your browser's local storage and are required for the Service
              to function.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">11. International Data Transfers</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your data is primarily stored and processed within the EU. If any data transfer outside
              the EU is necessary (e.g., to Vercel's edge network), it is protected by appropriate
              safeguards including Standard Contractual Clauses (SCCs) approved by the European
              Commission, or the recipient's participation in an adequacy framework.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">12. Children's Privacy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The Service is not directed at children under the age of 16. We do not knowingly
              collect personal data from children. If we become aware that we have collected data
              from a child under 16, we will take steps to delete that data promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">13. Changes to This Policy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of material
              changes via email or through the Service at least 30 days before they take effect.
              The "Last updated" date at the top of this page indicates when the policy was last revised.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">14. Contact</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              For any questions or concerns about this Privacy Policy or our data practices, please contact:
            </p>
            <div className="text-sm text-muted-foreground mt-2 bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground">GrantLume Ltd. — Data Protection</p>
              <p>Email: privacy@grantlume.com</p>
              <p>Website: www.grantlume.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

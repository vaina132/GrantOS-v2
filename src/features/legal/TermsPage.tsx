import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function TermsPage() {
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

        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Use</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: March 11, 2026</p>

        <div className="prose prose-sm prose-gray dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Acceptance of Terms</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              By accessing or using GrantLume ("the Service"), operated by GrantLume Ltd. ("we", "us", "our"),
              you agree to be bound by these Terms of Use ("Terms"). If you do not agree to these Terms,
              you must not use the Service. These Terms apply to all users, including individual users,
              organisation administrators, team members, and guest collaborators.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Description of Service</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              GrantLume is a cloud-based grant project management platform that enables research organisations
              to manage project portfolios, personnel allocations, timesheets, absences, budgets, financial
              tracking, and reporting. The Service is accessible at app.grantlume.com and through associated
              APIs and integrations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. Account Registration</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              To use the Service, you must create an account by providing accurate and complete information,
              including your first name, last name, and a valid email address. You are responsible for
              maintaining the confidentiality of your account credentials and for all activities that
              occur under your account. You must immediately notify us of any unauthorised use of your account.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground mt-2">
              You may also sign in using third-party authentication providers (Google, Microsoft, Slack).
              By doing so, you authorise us to access certain information from those services as described
              in our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Free Trial</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              New organisations may be eligible for a 14-day free trial. During the trial period, you will
              have access to all features of the Service. No payment information is required to start
              a trial. The trial period ends automatically after 14 days. If you do not subscribe to a
              paid plan before the trial expires, your access to the Service will be limited. Your data
              will be retained for 30 days after trial expiration, after which it may be permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Subscription and Payment</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Access to the Service beyond the trial period requires a paid subscription. Subscription
              fees are billed in advance on a monthly or annual basis, depending on the plan selected.
              All fees are non-refundable except as required by applicable law. We reserve the right
              to change our pricing with 30 days' notice. Continued use of the Service after a price
              change constitutes acceptance of the new pricing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. User Conduct</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">You agree not to:</p>
            <ul className="text-sm leading-relaxed text-muted-foreground mt-2 ml-4 space-y-1 list-disc">
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
              <li>Upload or transmit malicious code, viruses, or harmful data</li>
              <li>Attempt to gain unauthorised access to other accounts, systems, or networks</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Reverse-engineer, decompile, or disassemble any aspect of the Service</li>
              <li>Share your account credentials with third parties</li>
              <li>Use automated tools (bots, scrapers) to access the Service without our written consent</li>
              <li>Resell, sublicense, or redistribute the Service without authorisation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Data Ownership and Intellectual Property</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You retain all ownership rights to the data you upload, enter, or generate through the Service
              ("Your Data"). By using the Service, you grant us a limited, non-exclusive license to process
              Your Data solely for the purpose of providing and improving the Service. We do not claim
              ownership of Your Data.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground mt-2">
              All intellectual property rights in the Service, including but not limited to the software,
              design, trademarks, and documentation, are owned by GrantLume Ltd. or its licensors.
              Nothing in these Terms grants you any right to use our trademarks or branding.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Data Processing and Security</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We process Your Data in accordance with our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and
              applicable data protection laws, including the General Data Protection Regulation (GDPR).
              We implement appropriate technical and organisational measures to protect Your Data against
              unauthorised access, loss, or alteration. Your Data is stored on secure servers hosted
              within the European Union.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">9. Guest Access</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Organisation administrators may invite external users ("Guests") to access specific project
              data within the Service. Guests are subject to these Terms. The inviting organisation is
              responsible for ensuring that guest access is appropriate and compliant with their own
              data governance policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">10. Service Availability</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We strive to maintain high availability of the Service but do not guarantee uninterrupted
              access. We may temporarily suspend the Service for maintenance, updates, or security
              purposes. We will endeavour to provide advance notice of planned downtime where possible.
              We are not liable for any loss or damage resulting from Service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">11. Termination</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You may terminate your account at any time by contacting us at support@grantlume.com.
              We may suspend or terminate your account if you violate these Terms or if your subscription
              lapses. Upon termination, your right to use the Service ceases immediately. We will
              make Your Data available for export for 30 days following termination, after which it
              may be permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">12. Limitation of Liability</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              To the maximum extent permitted by applicable law, GrantLume Ltd. shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages, including loss of
              profits, data, or business opportunities, arising out of or in connection with the use of
              the Service. Our total aggregate liability shall not exceed the amount you paid for the
              Service in the twelve (12) months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">13. Disclaimer of Warranties</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The Service is provided "as is" and "as available" without warranties of any kind, either
              express or implied, including but not limited to implied warranties of merchantability,
              fitness for a particular purpose, and non-infringement. We do not warrant that the Service
              will be error-free, secure, or available at all times.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">14. Changes to Terms</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We reserve the right to modify these Terms at any time. We will notify you of material
              changes via email or through the Service at least 30 days before they take effect.
              Your continued use of the Service after the effective date of the revised Terms constitutes
              acceptance of the changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">15. Governing Law</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the
              Federal Republic of Germany. Any disputes arising under or in connection with these Terms
              shall be subject to the exclusive jurisdiction of the courts located in Berlin, Germany,
              without prejudice to the rights of consumers under mandatory local law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">16. Contact</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              If you have questions about these Terms, please contact us at:
            </p>
            <div className="text-sm text-muted-foreground mt-2 bg-muted/30 rounded-lg p-4">
              <p className="font-medium text-foreground">GrantLume Ltd.</p>
              <p>Email: legal@grantlume.com</p>
              <p>Website: www.grantlume.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

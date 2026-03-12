import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  CalendarDays,
  ClipboardCheck,
  DollarSign,
  GanttChart,
  FileText,
  Shield,
  Lightbulb,
  ArrowRight,
  Check,
  Globe,
  Menu,
  X,
  ChevronRight,
  Zap,
  Lock,
  BarChart3,
  Clock,
} from 'lucide-react'
import { GrantLumeLogo } from '@/components/common/GrantLumeLogo'

type Lang = 'en' | 'de'

const t = {
  en: {
    nav: {
      features: 'Features',
      pricing: 'Pricing',
      security: 'Security',
      login: 'Login',
      tryFree: 'Start Free Trial',
    },
    hero: {
      badge: '14-day free trial — No credit card required',
      title: 'Grant Management,',
      titleHighlight: 'Simplified.',
      subtitle:
        'GrantLume helps research organisations track projects, allocations, timesheets, budgets, and reporting — all in one beautifully designed platform.',
      cta: 'Start your free trial',
      ctaSub: 'No credit card needed · Set up in 2 minutes',
      login: 'Already have an account?',
    },
    stats: [
      { value: '100%', label: 'Cloud-based' },
      { value: '0€', label: 'Setup costs' },
      { value: '14', label: 'Free trial days' },
      { value: '5', label: 'User roles' },
    ],
    features: {
      title: 'Everything you need to manage grants',
      subtitle: 'From proposal to final report — one platform for your entire grant lifecycle.',
      list: [
        {
          icon: 'LayoutDashboard',
          title: 'Dashboard',
          desc: 'Real-time overview of your projects, budgets, staff, and key performance indicators at a glance.',
        },
        {
          icon: 'FolderKanban',
          title: 'Project Management',
          desc: 'Track all your grant projects with work packages, milestones, deliverables, and budget allocations.',
        },
        {
          icon: 'Lightbulb',
          title: 'Proposal Pipeline',
          desc: 'Manage proposals from idea to submission. Convert approved proposals directly into active projects.',
        },
        {
          icon: 'Users',
          title: 'Staff Management',
          desc: 'Manage your research team with roles, departments, employment types, and salary tracking.',
        },
        {
          icon: 'CalendarDays',
          title: 'Allocations',
          desc: 'Plan and track person-month allocations across projects. Visualise capacity and avoid over-commitment.',
        },
        {
          icon: 'ClipboardCheck',
          title: 'Timesheets',
          desc: 'Record, submit, and approve time entries. Support for approval workflows and period locking.',
        },
        {
          icon: 'DollarSign',
          title: 'Financial Tracking',
          desc: 'Budget management by category — personnel, travel, subcontracting, indirect costs. Real-time spend tracking.',
        },
        {
          icon: 'GanttChart',
          title: 'Project Timeline',
          desc: 'Interactive Gantt chart view of all projects with drag-and-drop scheduling and milestone tracking.',
        },
        {
          icon: 'FileText',
          title: 'Reports & Export',
          desc: 'Generate PDF reports for projects, budgets, timesheets, and proposals. Export data anytime.',
        },
        {
          icon: 'Shield',
          title: 'Audit Trail',
          desc: 'Full audit log of every change. Know who did what, when. Stay compliant with funding body requirements.',
        },
        {
          icon: 'BarChart3',
          title: 'Role-Based Access',
          desc: 'Five configurable roles: Admin, Project Manager, Finance Officer, Viewer, and External Participant.',
        },
        {
          icon: 'Clock',
          title: 'Guest Access',
          desc: 'Invite external partners to view projects or submit timesheets without full platform access.',
        },
      ],
    },
    howItWorks: {
      title: 'Up and running in minutes',
      steps: [
        { num: '1', title: 'Create your account', desc: 'Sign up for free — no credit card required.' },
        { num: '2', title: 'Set up your organisation', desc: 'Name your workspace, choose your currency, invite your team.' },
        { num: '3', title: 'Add your first project', desc: 'Import or create projects with budgets, work packages, and staff assignments.' },
        { num: '4', title: 'Manage & report', desc: 'Track time, allocations, expenses, and generate reports for your funding bodies.' },
      ],
    },
    pricing: {
      title: 'Simple, transparent pricing',
      subtitle: 'Start free. Upgrade when you need to.',
      plans: [
        {
          name: 'Trial',
          price: '0€',
          period: '14 days',
          desc: 'Try everything — no commitment',
          features: ['All features included', 'Up to 3 users', 'Unlimited projects', 'Email support'],
          cta: 'Start free trial',
          highlighted: false,
        },
        {
          name: 'Starter',
          price: '49€',
          period: '/month',
          desc: 'For small research groups',
          features: ['All features included', 'Up to 10 users', 'Unlimited projects', 'Priority email support', 'Data export'],
          cta: 'Start free trial',
          highlighted: true,
        },
        {
          name: 'Growth',
          price: '99€',
          period: '/month',
          desc: 'For growing organisations',
          features: ['All features included', 'Up to 50 users', 'Unlimited projects', 'Priority support', 'Custom roles', 'API access'],
          cta: 'Start free trial',
          highlighted: false,
        },
        {
          name: 'Enterprise',
          price: 'Custom',
          period: '',
          desc: 'For large institutions',
          features: ['Unlimited users', 'Unlimited projects', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'On-premise option'],
          cta: 'Contact us',
          highlighted: false,
        },
      ],
    },
    trust: {
      title: 'Built for European research organisations',
      items: [
        { icon: 'Lock', title: 'GDPR Compliant', desc: 'Your data stays in Europe. Full GDPR compliance built in.' },
        { icon: 'Shield', title: 'Secure by Design', desc: 'Row-level security, encrypted connections, and full audit trails.' },
        { icon: 'Zap', title: 'Always Available', desc: 'Cloud-hosted with 99.9% uptime. No installation, no maintenance.' },
      ],
    },
    cta: {
      title: 'Ready to simplify your grant management?',
      subtitle: 'Join research organisations across Europe who trust GrantLume.',
      button: 'Start your 14-day free trial',
      note: 'No credit card required · Cancel anytime',
    },
    footer: {
      tagline: 'Grant management software for research organisations.',
      product: 'Product',
      legal: 'Legal',
      terms: 'Terms of Use',
      privacy: 'Privacy Policy',
      copyright: '© 2025 GrantLume. All rights reserved.',
    },
  },
  de: {
    nav: {
      features: 'Funktionen',
      pricing: 'Preise',
      security: 'Sicherheit',
      login: 'Anmelden',
      tryFree: 'Kostenlos testen',
    },
    hero: {
      badge: '14 Tage kostenlos testen — Keine Kreditkarte erforderlich',
      title: 'Fördermittel-Management,',
      titleHighlight: 'vereinfacht.',
      subtitle:
        'GrantLume hilft Forschungsorganisationen, Projekte, Zuweisungen, Zeiterfassung, Budgets und Berichte an einem Ort zu verwalten — in einer elegant gestalteten Plattform.',
      cta: 'Kostenlos testen',
      ctaSub: 'Keine Kreditkarte nötig · In 2 Minuten eingerichtet',
      login: 'Bereits registriert?',
    },
    stats: [
      { value: '100%', label: 'Cloud-basiert' },
      { value: '0€', label: 'Einrichtungskosten' },
      { value: '14', label: 'Kostenlose Testtage' },
      { value: '5', label: 'Benutzerrollen' },
    ],
    features: {
      title: 'Alles, was Sie für die Fördermittelverwaltung brauchen',
      subtitle: 'Vom Antrag bis zum Schlussbericht — eine Plattform für den gesamten Förder-Lebenszyklus.',
      list: [
        {
          icon: 'LayoutDashboard',
          title: 'Dashboard',
          desc: 'Echtzeit-Überblick über Projekte, Budgets, Personal und Leistungskennzahlen auf einen Blick.',
        },
        {
          icon: 'FolderKanban',
          title: 'Projektmanagement',
          desc: 'Verwalten Sie alle Förderprojekte mit Arbeitspaketen, Meilensteinen, Deliverables und Budgetzuweisungen.',
        },
        {
          icon: 'Lightbulb',
          title: 'Antrags-Pipeline',
          desc: 'Verwalten Sie Anträge von der Idee bis zur Einreichung. Genehmigte Anträge direkt in aktive Projekte umwandeln.',
        },
        {
          icon: 'Users',
          title: 'Personalverwaltung',
          desc: 'Verwalten Sie Ihr Forschungsteam mit Rollen, Abteilungen, Beschäftigungsarten und Gehaltsverfolgung.',
        },
        {
          icon: 'CalendarDays',
          title: 'Zuweisungen',
          desc: 'Planen und verfolgen Sie Personenmonate über Projekte hinweg. Kapazitäten visualisieren und Überbelegung vermeiden.',
        },
        {
          icon: 'ClipboardCheck',
          title: 'Zeiterfassung',
          desc: 'Zeiten erfassen, einreichen und genehmigen. Unterstützung für Genehmigungsworkflows und Periodensperren.',
        },
        {
          icon: 'DollarSign',
          title: 'Finanzverfolgung',
          desc: 'Budgetverwaltung nach Kategorien — Personal, Reisen, Unteraufträge, indirekte Kosten. Echtzeit-Ausgabenverfolgung.',
        },
        {
          icon: 'GanttChart',
          title: 'Projekt-Timeline',
          desc: 'Interaktive Gantt-Diagramm-Ansicht aller Projekte mit Drag-and-Drop-Planung und Meilenstein-Tracking.',
        },
        {
          icon: 'FileText',
          title: 'Berichte & Export',
          desc: 'PDF-Berichte für Projekte, Budgets, Zeiterfassung und Anträge generieren. Daten jederzeit exportieren.',
        },
        {
          icon: 'Shield',
          title: 'Audit-Trail',
          desc: 'Vollständiges Protokoll jeder Änderung. Wer hat was wann gemacht? Bleiben Sie konform mit den Anforderungen der Fördergeber.',
        },
        {
          icon: 'BarChart3',
          title: 'Rollenbasierter Zugang',
          desc: 'Fünf konfigurierbare Rollen: Admin, Projektmanager, Finanzbeauftragte, Betrachter und Externe Teilnehmer.',
        },
        {
          icon: 'Clock',
          title: 'Gastzugang',
          desc: 'Laden Sie externe Partner ein, Projekte einzusehen oder Zeiten einzureichen — ohne vollen Plattformzugang.',
        },
      ],
    },
    howItWorks: {
      title: 'In wenigen Minuten einsatzbereit',
      steps: [
        { num: '1', title: 'Konto erstellen', desc: 'Kostenlos registrieren — keine Kreditkarte erforderlich.' },
        { num: '2', title: 'Organisation einrichten', desc: 'Benennen Sie Ihren Workspace, wählen Sie Ihre Währung, laden Sie Ihr Team ein.' },
        { num: '3', title: 'Erstes Projekt anlegen', desc: 'Importieren oder erstellen Sie Projekte mit Budgets, Arbeitspaketen und Personalzuweisungen.' },
        { num: '4', title: 'Verwalten & berichten', desc: 'Erfassen Sie Zeiten, Zuweisungen, Ausgaben und generieren Sie Berichte für Ihre Fördergeber.' },
      ],
    },
    pricing: {
      title: 'Einfache, transparente Preise',
      subtitle: 'Kostenlos starten. Upgraden, wenn Sie es brauchen.',
      plans: [
        {
          name: 'Testversion',
          price: '0€',
          period: '14 Tage',
          desc: 'Alles testen — ohne Verpflichtung',
          features: ['Alle Funktionen enthalten', 'Bis zu 3 Benutzer', 'Unbegrenzte Projekte', 'E-Mail-Support'],
          cta: 'Kostenlos testen',
          highlighted: false,
        },
        {
          name: 'Starter',
          price: '49€',
          period: '/Monat',
          desc: 'Für kleine Forschungsgruppen',
          features: ['Alle Funktionen enthalten', 'Bis zu 10 Benutzer', 'Unbegrenzte Projekte', 'Prioritäts-E-Mail-Support', 'Datenexport'],
          cta: 'Kostenlos testen',
          highlighted: true,
        },
        {
          name: 'Growth',
          price: '99€',
          period: '/Monat',
          desc: 'Für wachsende Organisationen',
          features: ['Alle Funktionen enthalten', 'Bis zu 50 Benutzer', 'Unbegrenzte Projekte', 'Prioritäts-Support', 'Benutzerdefinierte Rollen', 'API-Zugang'],
          cta: 'Kostenlos testen',
          highlighted: false,
        },
        {
          name: 'Enterprise',
          price: 'Individuell',
          period: '',
          desc: 'Für große Institutionen',
          features: ['Unbegrenzte Benutzer', 'Unbegrenzte Projekte', 'Dedizierter Support', 'Individuelle Integrationen', 'SLA-Garantie', 'On-Premise-Option'],
          cta: 'Kontaktieren Sie uns',
          highlighted: false,
        },
      ],
    },
    trust: {
      title: 'Entwickelt für europäische Forschungsorganisationen',
      items: [
        { icon: 'Lock', title: 'DSGVO-konform', desc: 'Ihre Daten bleiben in Europa. Volle DSGVO-Konformität integriert.' },
        { icon: 'Shield', title: 'Sicher konzipiert', desc: 'Zeilenbasierte Sicherheit, verschlüsselte Verbindungen und vollständige Audit-Trails.' },
        { icon: 'Zap', title: 'Immer verfügbar', desc: 'Cloud-gehostet mit 99,9% Verfügbarkeit. Keine Installation, keine Wartung.' },
      ],
    },
    cta: {
      title: 'Bereit, Ihre Fördermittelverwaltung zu vereinfachen?',
      subtitle: 'Schließen Sie sich Forschungsorganisationen in ganz Europa an, die GrantLume vertrauen.',
      button: 'Jetzt 14 Tage kostenlos testen',
      note: 'Keine Kreditkarte erforderlich · Jederzeit kündbar',
    },
    footer: {
      tagline: 'Fördermittel-Management-Software für Forschungsorganisationen.',
      product: 'Produkt',
      legal: 'Rechtliches',
      terms: 'Nutzungsbedingungen',
      privacy: 'Datenschutzerklärung',
      copyright: '© 2025 GrantLume. Alle Rechte vorbehalten.',
    },
  },
}

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  FolderKanban,
  Users,
  CalendarDays,
  ClipboardCheck,
  DollarSign,
  GanttChart,
  FileText,
  Shield,
  Lightbulb,
  BarChart3,
  Clock,
  Lock,
  Zap,
}

export function LandingPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const c = t[lang]

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <GrantLumeLogo size={34} variant="color" />
              <span className="text-xl font-bold tracking-tight"><span className="text-[#1a2744]">Grant</span><span className="text-emerald-600">Lume</span></span>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                {c.nav.features}
              </a>
              <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                {c.nav.pricing}
              </a>
              <a href="#trust" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                {c.nav.security}
              </a>
              <button
                onClick={() => setLang(lang === 'en' ? 'de' : 'en')}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                <Globe className="h-4 w-4" />
                {lang === 'en' ? 'DE' : 'EN'}
              </button>
              <Link
                to="/login"
                className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors"
              >
                {c.nav.login}
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                {c.nav.tryFree}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={() => setLang(lang === 'en' ? 'de' : 'en')}
                className="p-2 text-gray-500"
              >
                <Globe className="h-5 w-5" />
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-700">
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-3 border-t border-gray-100 pt-4">
              <a href="#features" className="block text-sm font-medium text-gray-600 py-1" onClick={() => setMobileMenuOpen(false)}>
                {c.nav.features}
              </a>
              <a href="#pricing" className="block text-sm font-medium text-gray-600 py-1" onClick={() => setMobileMenuOpen(false)}>
                {c.nav.pricing}
              </a>
              <a href="#trust" className="block text-sm font-medium text-gray-600 py-1" onClick={() => setMobileMenuOpen(false)}>
                {c.nav.security}
              </a>
              <div className="flex gap-3 pt-2">
                <Link to="/login" className="flex-1 text-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">
                  {c.nav.login}
                </Link>
                <Link to="/signup" className="flex-1 text-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">
                  {c.nav.tryFree}
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-100/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-4 py-1.5 text-sm font-medium text-blue-700 mb-8">
              <Zap className="h-3.5 w-3.5" />
              {c.hero.badge}
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
              {c.hero.title}
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {c.hero.titleHighlight}
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
              {c.hero.subtitle}
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30"
              >
                {c.hero.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                {c.hero.login}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="mt-4 text-sm text-gray-500">{c.hero.ctaSub}</p>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {c.stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-blue-600">{stat.value}</div>
                <div className="mt-1 text-sm text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{c.features.title}</h2>
            <p className="mt-4 text-lg text-gray-600">{c.features.subtitle}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {c.features.list.map((feature, i) => {
              const Icon = iconMap[feature.icon] || LayoutDashboard
              return (
                <div
                  key={i}
                  className="group rounded-2xl border border-gray-100 bg-white p-6 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50 transition-all duration-300"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center mb-16">
            {c.howItWorks.title}
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {c.howItWorks.steps.map((step, i) => (
              <div key={i} className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white font-bold text-lg mb-4">
                  {step.num}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{step.desc}</p>
                {i < 3 && (
                  <div className="hidden lg:block absolute top-6 left-[calc(100%_-_8px)] w-[calc(100%_-_40px)]">
                    <div className="border-t-2 border-dashed border-blue-200" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{c.pricing.title}</h2>
            <p className="mt-4 text-lg text-gray-600">{c.pricing.subtitle}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {c.pricing.plans.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-2xl p-6 ${
                  plan.highlighted
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20 ring-2 ring-blue-600 scale-[1.02]'
                    : 'bg-white border border-gray-200'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-yellow-400 px-3 py-0.5 text-xs font-bold text-gray-900">
                    Popular
                  </div>
                )}
                <div className="mb-4">
                  <h3 className={`text-lg font-semibold ${plan.highlighted ? 'text-white' : ''}`}>{plan.name}</h3>
                  <p className={`text-sm mt-1 ${plan.highlighted ? 'text-blue-100' : 'text-gray-500'}`}>{plan.desc}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  {plan.period && (
                    <span className={`text-sm ${plan.highlighted ? 'text-blue-200' : 'text-gray-500'}`}>
                      {' '}{plan.period}
                    </span>
                  )}
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.highlighted ? 'text-blue-200' : 'text-blue-600'}`} />
                      <span className={plan.highlighted ? 'text-blue-50' : 'text-gray-600'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={`block w-full text-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                    plan.highlighted
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust / Security ── */}
      <section id="trust" className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center mb-16">
            {c.trust.title}
          </h2>

          <div className="grid sm:grid-cols-3 gap-8">
            {c.trust.items.map((item, i) => {
              const Icon = iconMap[item.icon] || Shield
              return (
                <div key={i} className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 mb-4">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-8 py-16 sm:px-16 sm:py-20 text-center">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-300 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {c.cta.title}
              </h2>
              <p className="mt-4 text-lg text-blue-100 max-w-xl mx-auto">
                {c.cta.subtitle}
              </p>
              <div className="mt-8">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-blue-700 hover:bg-blue-50 transition-colors shadow-lg"
                >
                  {c.cta.button}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <p className="mt-4 text-sm text-blue-200">{c.cta.note}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid sm:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <GrantLumeLogo size={28} variant="color" />
                <span className="text-lg font-bold tracking-tight"><span className="text-[#1a2744]">Grant</span><span className="text-emerald-600">Lume</span></span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{c.footer.tagline}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">{c.footer.product}</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {c.nav.features}
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {c.nav.pricing}
                  </a>
                </li>
                <li>
                  <a href="#trust" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {c.nav.security}
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">{c.footer.legal}</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/terms" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {c.footer.terms}
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {c.footer.privacy}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">{c.footer.copyright}</p>
            <button
              onClick={() => setLang(lang === 'en' ? 'de' : 'en')}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Globe className="h-4 w-4" />
              {lang === 'en' ? 'Deutsch' : 'English'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}

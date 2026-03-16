import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderKanban,
  Users,
  CalendarDays,
  ClipboardCheck,
  DollarSign,
  Lightbulb,
  ArrowRight,
  Check,
  Globe,
  Menu,
  X,
  ChevronRight,
  Zap,
  Lock,
  Shield,
  Sparkles,
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
      tryFree: 'Try Free',
    },
    hero: {
      badge: 'Try free for 14 days',
      title: 'Stop managing grants',
      titleHighlight: 'in spreadsheets.',
      subtitle:
        'GrantLume is the all-in-one platform for research organisations to manage projects, budgets, timesheets, and partner collaborations.',
      cta: 'Start free trial',
      ctaSub: 'No credit card · Ready in 2 minutes',
      login: 'Already have an account?',
    },
    features: {
      title: 'One platform. Every grant.',
      subtitle: 'From proposal pipeline to financial reporting — everything your team needs.',
      list: [
        {
          icon: 'Lightbulb',
          title: 'Proposals to Projects',
          desc: 'Track proposals from idea to submission. One click converts a funded proposal into a live project with budgets and work packages.',
        },
        {
          icon: 'FolderKanban',
          title: 'Projects & Work Packages',
          desc: 'Manage grant projects with milestones, deliverables, reporting periods, and AI-powered document parsing.',
        },
        {
          icon: 'CalendarDays',
          title: 'Person-Month Allocations',
          desc: 'Plan and track staff effort across projects. Compare planned vs. actual. Spot over-commitments before they happen.',
        },
        {
          icon: 'ClipboardCheck',
          title: 'Timesheets & Absences',
          desc: 'Submit, approve, and lock timesheets. Track absences with substitutes. Full approval workflow built in.',
        },
        {
          icon: 'DollarSign',
          title: 'Budget & Expense Tracking',
          desc: 'Personnel, travel, subcontracting, indirect costs — all tracked by category with real-time budget-vs-actual.',
        },
        {
          icon: 'Users',
          title: 'Multi-Partner Collaboration',
          desc: 'Invite consortium partners. Collect financial reports per period. Track deviations. All from one dashboard.',
        },
      ],
    },
    extras: {
      title: 'Plus everything else you\'d expect',
      items: [
        'Interactive Gantt timeline',
        'PDF report generation',
        'AI grant document parsing',
        'Role-based permissions',
        'In-app notifications',
        'Multi-language (EN, DE, FR, ES, PT)',
        'Data import & export',
        'Dark mode',
      ],
    },
    pricing: {
      title: 'Simple pricing. No surprises.',
      subtitle: 'One price per organisation. Not per user.',
      yearly: 'Save 2 months with annual billing',
      plans: [
        {
          name: 'Free Trial',
          price: '0',
          period: '14 days',
          desc: 'See if GrantLume fits your team',
          features: ['All features included', '3 projects', '5 staff members', '2 user seats', '5 AI document parses'],
          cta: 'Start free trial',
          highlighted: false,
        },
        {
          name: 'Starter',
          price: '49',
          period: '/mo',
          desc: 'For small research groups',
          features: ['10 projects', '20 staff members', '5 user seats', '20 AI parses/month', 'PDF reports & export'],
          cta: 'Start free trial',
          highlighted: true,
        },
        {
          name: 'Growth',
          price: '99',
          period: '/mo',
          desc: 'For departments with partners',
          features: ['Unlimited projects', 'Unlimited staff', '20 user seats', '100 AI parses/month', 'Collaboration module', 'Custom role permissions'],
          cta: 'Start free trial',
          highlighted: false,
        },
      ],
      enterprise: 'Managing 50+ users or need custom integrations?',
      enterpriseCta: 'Talk to us',
    },
    trust: {
      title: 'Built for European research',
      badges: ['GDPR compliant', 'EU-hosted (Frankfurt)', 'AES-256 encryption', 'Row-level data isolation', 'No tracking cookies', 'Privacy by design'],
    },
    cta: {
      title: 'Your grants deserve better than a spreadsheet.',
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
      tryFree: 'Testen',
    },
    hero: {
      badge: '14 Tage kostenlos testen',
      title: 'Schluss mit Fördermittelverwaltung',
      titleHighlight: 'in Tabellen.',
      subtitle:
        'GrantLume ist die All-in-One-Plattform für Forschungsorganisationen zur Verwaltung von Projekten, Budgets, Zeiterfassung und Partnerkooperationen.',
      cta: 'Kostenlos testen',
      ctaSub: 'Keine Kreditkarte · In 2 Minuten startklar',
      login: 'Bereits registriert?',
    },
    features: {
      title: 'Eine Plattform. Jedes Förderprojekt.',
      subtitle: 'Von der Antrags-Pipeline bis zur Finanzberichterstattung — alles, was Ihr Team braucht.',
      list: [
        {
          icon: 'Lightbulb',
          title: 'Vom Antrag zum Projekt',
          desc: 'Anträge von der Idee bis zur Einreichung verfolgen. Ein Klick wandelt einen bewilligten Antrag in ein aktives Projekt um.',
        },
        {
          icon: 'FolderKanban',
          title: 'Projekte & Arbeitspakete',
          desc: 'Förderprojekte mit Meilensteinen, Deliverables, Berichtsperioden und KI-gestützter Dokumentenanalyse verwalten.',
        },
        {
          icon: 'CalendarDays',
          title: 'Personenmonat-Zuweisungen',
          desc: 'Personalaufwand projektübergreifend planen und verfolgen. Plan vs. Ist vergleichen. Überbelegungen frühzeitig erkennen.',
        },
        {
          icon: 'ClipboardCheck',
          title: 'Zeiterfassung & Abwesenheiten',
          desc: 'Zeiten einreichen, genehmigen und sperren. Abwesenheiten mit Vertretungen erfassen. Vollständiger Genehmigungsworkflow.',
        },
        {
          icon: 'DollarSign',
          title: 'Budget- & Ausgabenverfolgung',
          desc: 'Personal, Reisen, Unteraufträge, indirekte Kosten — alles nach Kategorie mit Echtzeit-Soll/Ist-Vergleich.',
        },
        {
          icon: 'Users',
          title: 'Multi-Partner-Kollaboration',
          desc: 'Konsortialpartner einladen. Finanzberichte pro Periode sammeln. Abweichungen verfolgen. Alles in einem Dashboard.',
        },
      ],
    },
    extras: {
      title: 'Plus alles andere, was Sie erwarten',
      items: [
        'Interaktive Gantt-Timeline',
        'PDF-Berichtsgenerierung',
        'KI-Dokumentenanalyse',
        'Rollenbasierte Berechtigungen',
        'In-App-Benachrichtigungen',
        'Mehrsprachig (EN, DE, FR, ES, PT)',
        'Datenimport & -export',
        'Dark Mode',
      ],
    },
    pricing: {
      title: 'Einfache Preise. Keine Überraschungen.',
      subtitle: 'Ein Preis pro Organisation. Nicht pro Benutzer.',
      yearly: '2 Monate sparen bei jährlicher Zahlung',
      plans: [
        {
          name: 'Testversion',
          price: '0',
          period: '14 Tage',
          desc: 'Testen Sie ob GrantLume zu Ihrem Team passt',
          features: ['Alle Funktionen enthalten', '3 Projekte', '5 Mitarbeiter', '2 Benutzer', '5 KI-Dokumentenanalysen'],
          cta: 'Kostenlos testen',
          highlighted: false,
        },
        {
          name: 'Starter',
          price: '49',
          period: '/Monat',
          desc: 'Für kleine Forschungsgruppen',
          features: ['10 Projekte', '20 Mitarbeiter', '5 Benutzer', '20 KI-Analysen/Monat', 'PDF-Berichte & Export'],
          cta: 'Kostenlos testen',
          highlighted: true,
        },
        {
          name: 'Growth',
          price: '99',
          period: '/Monat',
          desc: 'Für Abteilungen mit Partnern',
          features: ['Unbegrenzte Projekte', 'Unbegrenzte Mitarbeiter', '20 Benutzer', '100 KI-Analysen/Monat', 'Kollaborationsmodul', 'Individuelle Rollenberechtigungen'],
          cta: 'Kostenlos testen',
          highlighted: false,
        },
      ],
      enterprise: '50+ Benutzer oder individuelle Integrationen?',
      enterpriseCta: 'Sprechen Sie mit uns',
    },
    trust: {
      title: 'Entwickelt für europäische Forschung',
      badges: ['DSGVO-konform', 'EU-gehostet (Frankfurt)', 'AES-256-Verschlüsselung', 'Row-Level-Datenisolierung', 'Keine Tracking-Cookies', 'Privacy by Design'],
    },
    cta: {
      title: 'Ihre Förderprojekte verdienen Besseres als eine Tabelle.',
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
  FolderKanban,
  Users,
  CalendarDays,
  ClipboardCheck,
  DollarSign,
  Lightbulb,
  Lock,
  Shield,
  Zap,
  Sparkles,
}

export function LandingPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const c = t[lang]

  const hostname = window.location.hostname
  const isAppDomain = hostname.startsWith('app.') || hostname === 'localhost' || hostname === '127.0.0.1'
  const appBase = isAppDomain ? '' : 'https://app.grantlume.com'

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <GrantLumeLogo size={32} variant="color" />
              <span className="text-xl font-bold tracking-tight"><span className="text-[#1a2744]">Grant</span><span className="text-emerald-600">Lume</span></span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">{c.nav.features}</a>
              <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">{c.nav.pricing}</a>
              <a href="#trust" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">{c.nav.security}</a>
              <button onClick={() => setLang(lang === 'en' ? 'de' : 'en')} className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                <Globe className="h-4 w-4" />
                {lang === 'en' ? 'DE' : 'EN'}
              </button>
              <a href={`${appBase}/login`} className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors">{c.nav.login}</a>
              <a href={`${appBase}/signup`} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm">
                {c.nav.tryFree}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="md:hidden flex items-center gap-2">
              <button onClick={() => setLang(lang === 'en' ? 'de' : 'en')} className="p-2 text-gray-500">
                <Globe className="h-5 w-5" />
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-700">
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-3 border-t border-gray-100 pt-4">
              <a href="#features" className="block text-sm font-medium text-gray-600 py-1" onClick={() => setMobileMenuOpen(false)}>{c.nav.features}</a>
              <a href="#pricing" className="block text-sm font-medium text-gray-600 py-1" onClick={() => setMobileMenuOpen(false)}>{c.nav.pricing}</a>
              <a href="#trust" className="block text-sm font-medium text-gray-600 py-1" onClick={() => setMobileMenuOpen(false)}>{c.nav.security}</a>
              <div className="flex gap-3 pt-2">
                <a href={`${appBase}/login`} className="flex-1 text-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">{c.nav.login}</a>
                <a href={`${appBase}/signup`} className="flex-1 text-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">{c.nav.tryFree}</a>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-20 sm:pt-28 sm:pb-28">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-4 py-1.5 text-sm font-medium text-blue-700 mb-8">
              <Zap className="h-3.5 w-3.5" />
              {c.hero.badge}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              {c.hero.title}
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {c.hero.titleHighlight}
              </span>
            </h1>

            <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
              {c.hero.subtitle}
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={`${appBase}/signup`}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30"
              >
                {c.hero.cta}
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href={`${appBase}/login`} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
                {c.hero.login}
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-4 text-sm text-gray-500">{c.hero.ctaSub}</p>
          </div>
        </div>
      </section>

      {/* ── Features (6 cards) ── */}
      <section id="features" className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{c.features.title}</h2>
            <p className="mt-4 text-lg text-gray-600">{c.features.subtitle}</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {c.features.list.map((feature, i) => {
              const Icon = iconMap[feature.icon] || FolderKanban
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

          {/* ── Extras strip ── */}
          <div className="mt-14 rounded-2xl bg-gray-50 border border-gray-100 p-6 sm:p-8">
            <h3 className="text-base font-semibold text-gray-900 mb-4">{c.extras.title}</h3>
            <div className="flex flex-wrap gap-3">
              {c.extras.items.map((item, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-3.5 py-1.5 text-sm text-gray-700">
                  <Check className="h-3.5 w-3.5 text-blue-600" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing (3 cards + enterprise line) ── */}
      <section id="pricing" className="py-16 sm:py-24 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{c.pricing.title}</h2>
            <p className="mt-3 text-lg text-gray-600">{c.pricing.subtitle}</p>
            <p className="mt-1 text-sm text-blue-600 font-medium">{c.pricing.yearly}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {c.pricing.plans.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-2xl p-6 flex flex-col ${
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
                  <span className="text-4xl font-extrabold">{plan.price === '0' ? '0' : plan.price}</span>
                  <span className={`text-lg font-extrabold ${plan.highlighted ? 'text-white' : ''}`}>{plan.price !== '0' ? '€' : '€'}</span>
                  {plan.period && (
                    <span className={`text-sm ml-0.5 ${plan.highlighted ? 'text-blue-200' : 'text-gray-500'}`}>{plan.period}</span>
                  )}
                </div>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.highlighted ? 'text-blue-200' : 'text-blue-600'}`} />
                      <span className={plan.highlighted ? 'text-blue-50' : 'text-gray-600'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={`${appBase}/signup`}
                  className={`block w-full text-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                    plan.highlighted
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          <p className="text-center mt-8 text-sm text-gray-500">
            {c.pricing.enterprise}{' '}
            <a href="mailto:hello@grantlume.com" className="font-semibold text-blue-600 hover:underline">{c.pricing.enterpriseCta}</a>
          </p>
        </div>
      </section>

      {/* ── Trust (badge strip) ── */}
      <section id="trust" className="py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Lock className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{c.trust.title}</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            {c.trust.badges.map((badge, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700"
              >
                <Shield className="h-3.5 w-3.5 text-blue-500" />
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-8 py-14 sm:px-16 sm:py-16 text-center">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-300 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight max-w-lg mx-auto">
                {c.cta.title}
              </h2>
              <div className="mt-8">
                <a
                  href={`${appBase}/signup`}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-blue-700 hover:bg-blue-50 transition-colors shadow-lg"
                >
                  {c.cta.button}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-4 text-sm text-blue-200">{c.cta.note}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
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
                <li><a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{c.nav.features}</a></li>
                <li><a href="#pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{c.nav.pricing}</a></li>
                <li><a href="#trust" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{c.nav.security}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">{c.footer.legal}</h4>
              <ul className="space-y-2">
                <li><Link to="/terms" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{c.footer.terms}</Link></li>
                <li><Link to="/privacy" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{c.footer.privacy}</Link></li>
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

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Menu,
  X,
  Check,
  Clock4,
  CalendarX2,
  FileSignature,
  FileBarChart,
  Wallet,
  Plug,
  UsersRound,
  ShieldCheck,
  ChevronDown,
  Upload,
  ArrowRightLeft,
  Send,
  Sparkles,
} from 'lucide-react'
import { GrantLumeLogo } from '@/components/common/GrantLumeLogo'

/**
 * GrantLume landing — "Lindisfarne" direction.
 *
 * Palette: warm ivory canvas, navy-ink foreground, deep teal accent.
 * Typography: Inter Tight for display, Inter for body, JetBrains Mono for
 * labels/eyebrows. Self-hosted via @fontsource (GDPR-friendly — no calls
 * to fonts.googleapis.com).
 *
 * Visual system: inline SVG product mockup in the hero (a faked dashboard
 * with WP grid, KPI row, and a project timeline), then lucide icons for
 * each feature. Feature section uses the "split story" layout: 4 primary
 * cards (with an accent tile + larger copy) over 4 compact cards.
 *
 * Motion is reduced-motion-first — the global rule in index.css neutralises
 * transitions when the user opts out. Hover states stay on because they are
 * colour changes, not motion.
 */

type Lang = 'en' | 'de'

const i18n = {
  en: {
    nav: {
      features: 'Capabilities',
      process: 'How it works',
      pricing: 'Pricing',
      signIn: 'Sign in',
      cta: 'Start free trial',
    },
    hero: {
      h1a: 'Run Horizon Europe projects',
      h1b: 'without the spreadsheets.',
      lede:
        'Timesheets, absences, budgets, partner reporting, and deliverables in one EU-hosted workspace — built for research administrators and PIs.',
      primary: 'Start 30-day trial',
      secondary: 'See what\'s inside',
      note: 'No credit card. EU-hosted in Frankfurt. Cancel anytime.',
    },
    trust: {
      label: 'In use at research organisations across Germany, Austria, and the Netherlands',
    },
    features: {
      eyebrow: 'What\'s inside',
      h2: 'Eight modules, one grant file.',
      lede:
        'Every workflow an RTO, university, or SME needs to run a Horizon Europe grant from kickoff to final report.',
      primary: [
        {
          icon: 'Clock4',
          title: 'Timesheets',
          desc: 'FTE-accurate monthly timesheets with PI sign-off and audit-ready export.',
        },
        {
          icon: 'FileSignature',
          title: 'Proposals',
          desc: 'Draft Part B, budgets, and partner inputs in one shared document tree.',
        },
        {
          icon: 'Wallet',
          title: 'Financials',
          desc: 'Track co-financing, indirect costs, and WP budget burn per partner.',
        },
        {
          icon: 'FileBarChart',
          title: 'Reports',
          desc: 'Generate periodic and final reports from live timesheet and cost data.',
        },
      ],
      secondary: [
        {
          icon: 'CalendarX2',
          title: 'Absences',
          desc: 'Leave and sickness feed the WP effort plan.',
        },
        {
          icon: 'Plug',
          title: 'Integrations',
          desc: 'DATEV, SAP, Microsoft 365, EU Funding Portal.',
        },
        {
          icon: 'UsersRound',
          title: 'Roles',
          desc: 'PI, coordinator, finance, partner — scoped access.',
        },
        {
          icon: 'ShieldCheck',
          title: 'Privacy',
          desc: 'GDPR, ISO 27001, Frankfurt-hosted, no US sub-processors.',
        },
      ],
    },
    process: {
      eyebrow: 'Getting started',
      h2: 'Four weeks from contract to first report.',
      steps: [
        {
          icon: 'Upload',
          title: 'Import',
          desc: 'Upload your Grant Agreement, WP plan, and partner list.',
        },
        {
          icon: 'ArrowRightLeft',
          title: 'Map',
          desc: 'We map your cost categories, FTE rates, and reporting periods.',
        },
        {
          icon: 'UsersRound',
          title: 'Invite',
          desc: 'PIs, finance officers, and partners sign in via SSO.',
        },
        {
          icon: 'Send',
          title: 'Report',
          desc: 'Export the periodic report from the live project file.',
        },
      ],
    },
    pricing: {
      eyebrow: 'Pricing',
      h2: 'One price. Your whole organisation.',
      lede:
        'Flat monthly fee per organisation. Unlimited users, unlimited partners, unlimited active grants.',
      plans: [
        {
          name: 'Free Trial',
          price: '0',
          unit: '€  ·  30 days',
          tagline: 'Full Pro access for 30 days. No card required.',
          badge: null,
          features: [
            'All Pro features',
            'Unlimited projects and partners',
            'Unlimited user seats',
            '5 AI drafting requests',
          ],
          cta: 'Start free trial',
        },
        {
          name: 'Pro',
          price: '149',
          unit: '€  ·  per month',
          tagline: 'Everything GrantLume does, unlimited.',
          badge: 'Recommended',
          features: [
            'Unlimited projects, staff, and partners',
            'Unlimited user seats',
            '100 AI drafting requests per month',
            'SSO, audit log, custom roles',
          ],
          cta: 'Start with Pro',
        },
      ],
      reassure: 'No per-seat upsell. No module paywall. Cancel anytime. Full data export (CSV + JSON).',
    },
    cta: {
      h2: 'See your next grant run in GrantLume.',
      lede:
        'Start the trial with a real Grant Agreement. If it doesn\'t save your project office time in 30 days, don\'t continue.',
      primary: 'Start 30-day trial',
      note: 'No credit card. EU-hosted. Export anytime.',
    },
    footer: {
      tagline: 'Grant management for European research teams.',
      product: 'Product',
      company: 'Company',
      legal: 'Legal',
      links: {
        features: 'Capabilities',
        pricing: 'Pricing',
        process: 'How it works',
        signIn: 'Sign in',
        about: 'About',
        contact: 'Contact',
        terms: 'Terms',
        privacy: 'Privacy',
        imprint: 'Imprint',
      },
      madeIn: 'Built in Europe. Hosted in Frankfurt.',
    },
  },
  de: {
    nav: {
      features: 'Funktionen',
      process: 'Ablauf',
      pricing: 'Preise',
      signIn: 'Anmelden',
      cta: 'Kostenlos testen',
    },
    hero: {
      h1a: 'Horizon-Europe-Projekte steuern',
      h1b: '— ohne Excel-Tabellen.',
      lede:
        'Stundenzettel, Abwesenheiten, Budgets, Partnerberichte und Deliverables in einem EU-gehosteten Arbeitsbereich — für Forschungsadministration und Projektleitungen.',
      primary: '30 Tage kostenlos testen',
      secondary: 'Funktionen ansehen',
      note: 'Keine Kreditkarte. Gehostet in Frankfurt. Jederzeit kündbar.',
    },
    trust: {
      label: 'Im Einsatz bei Forschungseinrichtungen in Deutschland, Österreich und den Niederlanden',
    },
    features: {
      eyebrow: 'Funktionsumfang',
      h2: 'Acht Module, eine Projektakte.',
      lede:
        'Jeder Arbeitsschritt, den Forschungseinrichtungen, Hochschulen und KMU für ein Horizon-Europe-Projekt vom Kickoff bis zum Abschlussbericht brauchen.',
      primary: [
        {
          icon: 'Clock4',
          title: 'Stundenzettel',
          desc: 'FTE-genaue Monatsstundenzettel mit PI-Freigabe und prüffähigem Export.',
        },
        {
          icon: 'FileSignature',
          title: 'Antragstellung',
          desc: 'Part B, Budget und Partnerbeiträge in einer gemeinsamen Dokumentstruktur.',
        },
        {
          icon: 'Wallet',
          title: 'Finanzen',
          desc: 'Co-Finanzierung, indirekte Kosten und AP-Budgetverbrauch je Partner.',
        },
        {
          icon: 'FileBarChart',
          title: 'Berichte',
          desc: 'Zwischen- und Abschlussberichte direkt aus Stunden- und Kostendaten.',
        },
      ],
      secondary: [
        {
          icon: 'CalendarX2',
          title: 'Abwesenheiten',
          desc: 'Urlaub und Krankheit fließen in den AP-Plan ein.',
        },
        {
          icon: 'Plug',
          title: 'Integrationen',
          desc: 'DATEV, SAP, Microsoft 365, EU Funding Portal.',
        },
        {
          icon: 'UsersRound',
          title: 'Rollen',
          desc: 'PI, Koordination, Finanzen, Partner — feingranular.',
        },
        {
          icon: 'ShieldCheck',
          title: 'Datenschutz',
          desc: 'DSGVO, ISO 27001, Hosting in Frankfurt, keine US-Auftragsverarbeiter.',
        },
      ],
    },
    process: {
      eyebrow: 'So starten Sie',
      h2: 'Vier Wochen vom Vertrag zum ersten Bericht.',
      steps: [
        {
          icon: 'Upload',
          title: 'Importieren',
          desc: 'Grant Agreement, AP-Plan und Partnerliste hochladen.',
        },
        {
          icon: 'ArrowRightLeft',
          title: 'Abbilden',
          desc: 'Wir bilden Kostenarten, FTE-Sätze und Berichtsperioden ab.',
        },
        {
          icon: 'UsersRound',
          title: 'Einladen',
          desc: 'PIs, Finanzstellen und Partner melden sich per SSO an.',
        },
        {
          icon: 'Send',
          title: 'Berichten',
          desc: 'Zwischenbericht direkt aus der aktiven Projektakte exportieren.',
        },
      ],
    },
    pricing: {
      eyebrow: 'Preise',
      h2: 'Ein Preis. Ihre gesamte Organisation.',
      lede:
        'Monatliche Pauschale je Organisation. Unbegrenzte Nutzer, Partner und aktive Projekte.',
      plans: [
        {
          name: 'Testphase',
          price: '0',
          unit: '€  ·  30 Tage',
          tagline: '30 Tage voller Pro-Zugriff. Ohne Kreditkarte.',
          badge: null,
          features: [
            'Alle Pro-Funktionen',
            'Unbegrenzte Projekte und Partner',
            'Unbegrenzte Benutzer',
            '5 KI-Entwurfsanfragen',
          ],
          cta: 'Kostenlos starten',
        },
        {
          name: 'Pro',
          price: '149',
          unit: '€  ·  pro Monat',
          tagline: 'Alles, was GrantLume kann, unbegrenzt.',
          badge: 'Empfohlen',
          features: [
            'Unbegrenzte Projekte, Mitarbeiter und Partner',
            'Unbegrenzte Benutzer',
            '100 KI-Entwurfsanfragen pro Monat',
            'SSO, Audit-Log, eigene Rollen',
          ],
          cta: 'Mit Pro starten',
        },
      ],
      reassure: 'Kein Seat-Upsell. Keine Modulsperre. Jederzeit kündbar. Vollständiger Datenexport (CSV + JSON).',
    },
    cta: {
      h2: 'Ihr nächstes Projekt in GrantLume ansehen.',
      lede:
        'Testen Sie mit einem echten Grant Agreement. Spart es Ihrem Projektbüro in 30 Tagen keine Zeit, kündigen Sie.',
      primary: '30 Tage kostenlos testen',
      note: 'Keine Kreditkarte. EU-Hosting. Daten jederzeit exportierbar.',
    },
    footer: {
      tagline: 'Fördermittelverwaltung für europäische Forschungsteams.',
      product: 'Produkt',
      company: 'Unternehmen',
      legal: 'Rechtliches',
      links: {
        features: 'Funktionen',
        pricing: 'Preise',
        process: 'Ablauf',
        signIn: 'Anmelden',
        about: 'Über uns',
        contact: 'Kontakt',
        terms: 'AGB',
        privacy: 'Datenschutz',
        imprint: 'Impressum',
      },
      madeIn: 'Gebaut in Europa. Gehostet in Frankfurt.',
    },
  },
}

const FEATURE_ICONS: Record<string, React.ElementType> = {
  Clock4, CalendarX2, FileSignature, FileBarChart,
  Wallet, Plug, UsersRound, ShieldCheck,
  Upload, ArrowRightLeft, Send, Sparkles,
}

/* ────────────────────────────────────────────────────────────────────── */

export function LandingPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const c = i18n[lang]

  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const isAppDomain =
    hostname.startsWith('app.') || hostname === 'localhost' || hostname === '127.0.0.1'
  const appBase = isAppDomain ? '' : 'https://app.grantlume.com'

  // Persist language choice.
  useEffect(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('gl_lang') : null
    if (saved === 'en' || saved === 'de') setLang(saved)
  }, [])
  useEffect(() => {
    try { localStorage.setItem('gl_lang', lang) } catch { /* no-op */ }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }, [lang])

  // Elevated nav after scroll.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-canvas font-sans text-foreground2 antialiased selection:bg-brand selection:text-brand-ink">

      {/* ═══════════════════ SKIP LINK ═══════════════════ */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded focus:bg-foreground2 focus:text-canvas focus:px-4 focus:py-2 focus:outline-none focus:ring-2 focus:ring-brand"
      >
        Skip to content
      </a>

      {/* ═══════════════════ NAV ═══════════════════ */}
      <header
        className={`sticky top-0 z-50 transition-colors ${
          scrolled
            ? 'bg-canvas/85 backdrop-blur-md border-b border-rule'
            : 'bg-canvas border-b border-transparent'
        }`}
      >
        <nav
          aria-label="Primary"
          className="max-w-7xl mx-auto px-6 lg:px-10"
        >
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5" aria-label="GrantLume — home">
              <GrantLumeLogo size={28} variant="color" />
              <span className="font-display text-[17px] font-semibold tracking-snug leading-none">
                <span className="text-foreground2">Grant</span>
                <span className="text-brand">Lume</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-foreground2/75 hover:text-foreground2 transition-colors">
                {c.nav.features}
              </a>
              <a href="#process" className="text-sm text-foreground2/75 hover:text-foreground2 transition-colors">
                {c.nav.process}
              </a>
              <a href="#pricing" className="text-sm text-foreground2/75 hover:text-foreground2 transition-colors">
                {c.nav.pricing}
              </a>
              <LangToggle lang={lang} setLang={setLang} />
              <a
                href={`${appBase}/login`}
                className="text-sm text-foreground2/75 hover:text-foreground2 transition-colors"
              >
                {c.nav.signIn}
              </a>
              <a
                href={`${appBase}/signup`}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground2 text-canvas px-4 h-9 text-sm font-medium hover:bg-brand transition-colors"
              >
                {c.nav.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <button
              className="md:hidden p-2 text-foreground2 h-11 w-11 flex items-center justify-center"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {menuOpen && (
            <div className="md:hidden pb-5 pt-3 border-t border-rule divide-y divide-rule-soft">
              <a href="#features" onClick={() => setMenuOpen(false)} className="block text-sm text-foreground2 py-3">
                {c.nav.features}
              </a>
              <a href="#process" onClick={() => setMenuOpen(false)} className="block text-sm text-foreground2 py-3">
                {c.nav.process}
              </a>
              <a href="#pricing" onClick={() => setMenuOpen(false)} className="block text-sm text-foreground2 py-3">
                {c.nav.pricing}
              </a>
              <a href={`${appBase}/login`} onClick={() => setMenuOpen(false)} className="block text-sm text-foreground2 py-3">
                {c.nav.signIn}
              </a>
              <div className="flex items-center justify-between pt-4 gap-3">
                <LangToggle lang={lang} setLang={setLang} />
                <a
                  href={`${appBase}/signup`}
                  className="flex-1 ml-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground2 text-canvas h-11 text-sm font-medium"
                >
                  {c.nav.cta} <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}
        </nav>
      </header>

      <main id="main">

        {/* ═══════════════════ HERO ═══════════════════ */}
        <section className="relative overflow-hidden">
          {/* Soft ambient wash behind the mockup */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
            style={{
              background:
                'radial-gradient(900px 420px at 78% 0%, rgba(15,76,92,0.10) 0%, rgba(15,76,92,0) 70%)',
            }}
          />
          {/* Subtle dot grid on canvas */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(11,27,43,0.07) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              maskImage: 'linear-gradient(180deg, black 40%, transparent 90%)',
              WebkitMaskImage: 'linear-gradient(180deg, black 40%, transparent 90%)',
            }}
          />

          <div className="relative max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-20 sm:pt-24 sm:pb-28">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
              <div className="lg:col-span-6 xl:col-span-5">
                <h1 className="font-display font-semibold tracking-tight2 text-[2.5rem] sm:text-5xl lg:text-[4rem] leading-[1.02] text-foreground2">
                  {c.hero.h1a}
                  <br />
                  <span className="text-brand">{c.hero.h1b}</span>
                </h1>

                <p className="mt-6 text-lg text-foreground2-muted max-w-xl leading-relaxed">
                  {c.hero.lede}
                </p>

                <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <a
                    href={`${appBase}/signup`}
                    className="group inline-flex items-center gap-2 rounded-full bg-foreground2 text-canvas px-6 h-12 text-sm font-medium hover:bg-brand transition-colors"
                  >
                    {c.hero.primary}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                  <a
                    href="#features"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground2 hover:text-brand transition-colors"
                  >
                    {c.hero.secondary}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>

                <p className="mt-4 text-xs text-foreground2-muted">
                  {c.hero.note}
                </p>
              </div>

              <div className="lg:col-span-6 xl:col-span-7">
                <DashboardMockup />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ TRUST STRIP ═══════════════════ */}
        <section className="border-y border-rule bg-canvas-raised">
          <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
            <p className="font-mono text-[11px] uppercase tracking-label text-foreground2-muted">
              {c.trust.label}
            </p>
            <div className="flex items-center gap-6 sm:gap-8 opacity-60">
              {['TU Delft', 'Fraunhofer', 'KTH', 'Charité', 'ETH Zürich'].map((mark) => (
                <span
                  key={mark}
                  className="font-display text-sm font-semibold tracking-snug text-foreground2/80 whitespace-nowrap"
                >
                  {mark}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ FEATURES ═══════════════════ */}
        <section id="features" className="relative">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 sm:py-32">
            <div className="max-w-2xl mb-16">
              <p className="font-mono text-[11px] uppercase tracking-label text-brand mb-4">
                — {c.features.eyebrow}
              </p>
              <h2 className="font-display font-semibold tracking-tight2 text-3xl sm:text-5xl leading-[1.05] text-foreground2">
                {c.features.h2}
              </h2>
              <p className="mt-5 text-base sm:text-lg text-foreground2-muted leading-relaxed">
                {c.features.lede}
              </p>
            </div>

            {/* Primary cards — 4 columns of real estate */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {c.features.primary.map((card) => {
                const Icon = FEATURE_ICONS[card.icon]
                return (
                  <div
                    key={card.title}
                    className="group relative rounded-2xl border border-rule bg-canvas-raised p-6 hover:border-foreground2/25 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-wash text-brand">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <h3 className="font-display text-lg font-semibold tracking-snug text-foreground2">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm text-foreground2-muted leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Secondary strip — 4 compact cards */}
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {c.features.secondary.map((card) => {
                const Icon = FEATURE_ICONS[card.icon]
                return (
                  <div
                    key={card.title}
                    className="rounded-xl border border-rule bg-canvas p-5 hover:bg-canvas-raised hover:border-foreground2/25 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <Icon className="h-4 w-4 text-foreground2/70" strokeWidth={1.75} />
                      <h3 className="font-display text-sm font-semibold text-foreground2">
                        {card.title}
                      </h3>
                    </div>
                    <p className="text-xs text-foreground2-muted leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ═══════════════════ PROCESS ═══════════════════ */}
        <section id="process" className="border-t border-rule bg-canvas-raised">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 sm:py-32">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-14">
              <div className="lg:col-span-4">
                <p className="font-mono text-[11px] uppercase tracking-label text-brand mb-4">
                  — {c.process.eyebrow}
                </p>
                <h2 className="font-display font-semibold tracking-tight2 text-3xl sm:text-5xl leading-[1.05] text-foreground2">
                  {c.process.h2}
                </h2>
              </div>

              <ol className="lg:col-span-8 grid sm:grid-cols-2 gap-5">
                {c.process.steps.map((step, i) => {
                  const Icon = FEATURE_ICONS[step.icon]
                  return (
                    <li
                      key={step.title}
                      className="relative rounded-2xl border border-rule bg-canvas p-6"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-wash text-brand">
                          <Icon className="h-5 w-5" strokeWidth={1.75} />
                        </div>
                        <span className="font-mono text-xs text-foreground2-muted">
                          0{i + 1}
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-semibold text-foreground2">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm text-foreground2-muted leading-relaxed">
                        {step.desc}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        </section>

        {/* ═══════════════════ PRICING ═══════════════════ */}
        <section id="pricing" className="border-t border-rule">
          <div className="max-w-5xl mx-auto px-6 lg:px-10 py-24 sm:py-32">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="font-mono text-[11px] uppercase tracking-label text-brand mb-4">
                — {c.pricing.eyebrow}
              </p>
              <h2 className="font-display font-semibold tracking-tight2 text-3xl sm:text-5xl leading-[1.05] text-foreground2">
                {c.pricing.h2}
              </h2>
              <p className="mt-4 text-base sm:text-lg text-foreground2-muted">
                {c.pricing.lede}
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {c.pricing.plans.map((plan) => {
                const isPro = !!plan.badge
                return (
                  <div
                    key={plan.name}
                    className={`relative rounded-2xl p-8 flex flex-col ${
                      isPro
                        ? 'bg-canvas-raised border-2 border-brand shadow-[0_0_0_4px_rgba(15,76,92,0.06)]'
                        : 'bg-canvas-raised border border-rule'
                    }`}
                  >
                    {isPro && (
                      <span className="absolute -top-3 left-8 px-2.5 py-0.5 rounded-full bg-brand text-brand-ink font-mono text-[10px] uppercase tracking-label">
                        {plan.badge}
                      </span>
                    )}
                    <div>
                      <h3 className="font-display text-xl font-semibold text-foreground2">
                        {plan.name}
                      </h3>
                      <p className="mt-1 text-sm text-foreground2-muted">{plan.tagline}</p>
                    </div>
                    <div className="mt-7 flex items-baseline gap-2">
                      <span className="font-display text-6xl font-semibold tracking-tight2 text-foreground2 leading-none tabular-nums">
                        {plan.price}
                      </span>
                      <span className="font-mono text-xs text-foreground2-muted uppercase tracking-label">
                        {plan.unit}
                      </span>
                    </div>
                    <ul className="mt-7 space-y-3 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-foreground2-soft">
                          <Check className="h-4 w-4 mt-0.5 shrink-0 text-brand" strokeWidth={2.5} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <a
                      href={`${appBase}/signup`}
                      className={`mt-8 inline-flex items-center justify-center gap-1.5 rounded-full h-11 text-sm font-medium transition-colors ${
                        isPro
                          ? 'bg-brand text-brand-ink hover:bg-brand-hover'
                          : 'bg-foreground2 text-canvas hover:bg-brand'
                      }`}
                    >
                      {plan.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )
              })}
            </div>

            <p className="mt-8 text-center text-xs text-foreground2-muted max-w-xl mx-auto">
              {c.pricing.reassure}
            </p>
          </div>
        </section>

        {/* ═══════════════════ FINAL CTA ═══════════════════ */}
        <section className="border-t border-rule bg-canvas-warm">
          <div className="max-w-4xl mx-auto px-6 lg:px-10 py-24 sm:py-32 text-center">
            <h2 className="font-display font-semibold tracking-tight2 text-4xl sm:text-5xl lg:text-6xl leading-[1.02] text-foreground2">
              {c.cta.h2}
            </h2>
            <p className="mt-6 max-w-xl mx-auto text-base sm:text-lg text-foreground2-muted">
              {c.cta.lede}
            </p>
            <div className="mt-10">
              <a
                href={`${appBase}/signup`}
                className="group inline-flex items-center gap-2 rounded-full bg-foreground2 text-canvas px-7 h-12 text-sm font-medium hover:bg-brand transition-colors"
              >
                {c.cta.primary}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
            <p className="mt-4 text-xs text-foreground2-muted">{c.cta.note}</p>
          </div>
        </section>
      </main>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="border-t border-rule bg-canvas">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
          <div className="grid sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
            <div>
              <div className="flex items-center gap-2">
                <GrantLumeLogo size={26} variant="color" />
                <span className="font-display text-base font-semibold tracking-snug">
                  <span className="text-foreground2">Grant</span>
                  <span className="text-brand">Lume</span>
                </span>
              </div>
              <p className="mt-4 text-sm text-foreground2-muted max-w-[32ch] leading-relaxed">
                {c.footer.tagline}
              </p>
            </div>

            <FooterCol title={c.footer.product}>
              <FooterLink href="#features">{c.footer.links.features}</FooterLink>
              <FooterLink href="#process">{c.footer.links.process}</FooterLink>
              <FooterLink href="#pricing">{c.footer.links.pricing}</FooterLink>
              <FooterLink href={`${appBase}/login`}>{c.footer.links.signIn}</FooterLink>
            </FooterCol>

            <FooterCol title={c.footer.company}>
              <FooterLink href="mailto:hello@grantlume.com">{c.footer.links.contact}</FooterLink>
            </FooterCol>

            <FooterCol title={c.footer.legal}>
              <FooterLink to="/terms">{c.footer.links.terms}</FooterLink>
              <FooterLink to="/privacy">{c.footer.links.privacy}</FooterLink>
            </FooterCol>
          </div>

          <div className="mt-12 pt-6 border-t border-rule flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="font-mono text-[10px] uppercase tracking-label text-foreground2-muted">
              © {new Date().getFullYear()} GrantLume  ·  {c.footer.madeIn}
            </p>
            <LangToggle lang={lang} setLang={setLang} />
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ═══════════════════ Sub-components ═══════════════════ */

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-full border border-rule overflow-hidden text-[11px] font-mono uppercase tracking-label"
    >
      {(['en', 'de'] as const).map((l) => {
        const active = lang === l
        return (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-pressed={active}
            className={`px-2.5 h-7 transition-colors ${
              active
                ? 'bg-foreground2 text-canvas'
                : 'text-foreground2-muted hover:text-foreground2'
            }`}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-mono text-[10px] uppercase tracking-label text-foreground2-muted mb-4">
        {title}
      </h3>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  )
}

function FooterLink({ href, to, children }: { href?: string; to?: string; children: React.ReactNode }) {
  const cls = 'text-sm text-foreground2/75 hover:text-foreground2 transition-colors'
  if (to) return <li><Link to={to} className={cls}>{children}</Link></li>
  return <li><a href={href} className={cls}>{children}</a></li>
  void ChevronDown
}

/* ───────────────────────────────────────────────────────────────────
   Hero product mockup — inline SVG (no image requests, themeable,
   ~4 KB uncompressed). Shows a fake GrantLume dashboard: breadcrumb,
   KPI row, work-package Gantt-style timeline, floating notification.
   Reduced-motion-safe — no animation attached.
   ─────────────────────────────────────────────────────────────────── */

function DashboardMockup() {
  return (
    <div className="relative mx-auto max-w-[600px] lg:max-w-none">
      {/* Floating notification card — top-right */}
      <div className="hidden sm:block absolute -top-3 -right-2 z-10 rounded-xl border border-rule bg-canvas-raised px-3 py-2 shadow-[0_10px_30px_-15px_rgba(11,27,43,0.25)]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-brand/10 flex items-center justify-center">
            <Check className="h-3.5 w-3.5 text-brand" strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <div className="text-[11px] font-medium text-foreground2">Budget approved</div>
            <div className="text-[10px] text-foreground2-muted font-mono">WP3 · €48,200</div>
          </div>
        </div>
      </div>

      {/* Floating notification — bottom-left */}
      <div className="hidden sm:block absolute -bottom-3 -left-3 z-10 rounded-xl border border-rule bg-canvas-raised px-3 py-2 shadow-[0_10px_30px_-15px_rgba(11,27,43,0.25)]">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-canvas-warm flex items-center justify-center">
            <UsersRound className="h-3.5 w-3.5 text-foreground2/70" strokeWidth={1.75} />
          </div>
          <div className="text-left">
            <div className="text-[11px] font-medium text-foreground2">Partner invited</div>
            <div className="text-[10px] text-foreground2-muted font-mono">TU Delft · 2 min ago</div>
          </div>
        </div>
      </div>

      {/* The dashboard frame */}
      <div className="relative rounded-2xl border border-rule bg-canvas-raised shadow-[0_30px_80px_-30px_rgba(11,27,43,0.25)] overflow-hidden">
        {/* Chrome */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rule" />
            <span className="h-2.5 w-2.5 rounded-full bg-rule" />
            <span className="h-2.5 w-2.5 rounded-full bg-rule" />
          </div>
          <div className="font-mono text-[10px] text-foreground2-muted tracking-snug">
            app.grantlume.com / Horizon Europe / CLIMATE-2028
          </div>
          <span className="w-10" />
        </div>

        <div className="grid grid-cols-[56px_1fr]">
          {/* Sidebar */}
          <div className="border-r border-rule bg-canvas p-3 flex flex-col gap-4 items-center">
            {[FileBarChart, Clock4, UsersRound, Wallet, FileSignature].map((Ic, i) => (
              <div
                key={i}
                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                  i === 0 ? 'bg-brand/12 text-brand' : 'text-foreground2/40'
                }`}
              >
                <Ic className="h-4 w-4" strokeWidth={1.75} />
              </div>
            ))}
          </div>

          {/* Main panel */}
          <div className="p-5 space-y-5">
            {/* Header + KPI row */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-label text-foreground2-muted">
                  Overview
                </div>
                <div className="font-display text-sm font-semibold text-foreground2 mt-0.5">
                  CLIMATE-2028 · Overview
                </div>
              </div>
              <span className="font-mono text-[10px] text-foreground2-muted">M14 / M48</span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Budget burn',  val: '62%',     sub: '€2.4M of €3.9M' },
                { label: 'Hours / month', val: '1,284',   sub: '38 researchers' },
                { label: 'Partners on track', val: '7 / 9', sub: 'TU Delft, KTH, Charité…' },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-rule bg-canvas px-3 py-2.5">
                  <div className="font-mono text-[9px] uppercase tracking-label text-foreground2-muted">
                    {k.label}
                  </div>
                  <div className="font-display text-base font-semibold text-foreground2 mt-1 tabular-nums">
                    {k.val}
                  </div>
                  <div className="text-[9px] text-foreground2-muted mt-0.5 truncate">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Gantt-like WP timeline */}
            <div className="rounded-lg border border-rule bg-canvas p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="font-mono text-[10px] uppercase tracking-label text-foreground2-muted">
                  Work packages
                </div>
                <div className="font-mono text-[9px] text-foreground2-muted">Months 1 — 48</div>
              </div>
              <div className="space-y-1.5">
                {[
                  { wp: 'WP1 · Coordination',    start: 0,  end: 100, col: 'bg-brand/70' },
                  { wp: 'WP2 · Modelling',        start: 0,  end: 70,  col: 'bg-brand/55' },
                  { wp: 'WP3 · Pilot sites',      start: 10, end: 80,  col: 'bg-brand/55' },
                  { wp: 'WP4 · Impact study',     start: 25, end: 100, col: 'bg-brand/45' },
                  { wp: 'WP5 · Dissemination',    start: 40, end: 100, col: 'bg-brand/35' },
                ].map((b) => (
                  <div key={b.wp} className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <div className="text-[10px] font-mono text-foreground2/80 truncate">{b.wp}</div>
                    <div className="relative h-3 bg-rule/60 rounded-sm">
                      <div
                        className={`absolute inset-y-0 rounded-sm ${b.col}`}
                        style={{ left: `${b.start}%`, right: `${100 - b.end}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* "Today" marker */}
              <div className="mt-1 grid grid-cols-[110px_1fr] gap-2">
                <span />
                <div className="relative h-2">
                  <div className="absolute inset-y-0 w-px bg-state-error" style={{ left: '30%' }} />
                  <span className="absolute top-full mt-0.5 text-[9px] font-mono text-state-error" style={{ left: '30%', transform: 'translateX(-50%)' }}>
                    M14
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

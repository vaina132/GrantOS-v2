import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Menu, X, Globe, Check } from 'lucide-react'
import { GrantLumeLogo } from '@/components/common/GrantLumeLogo'

/**
 * GrantLume landing — editorial redesign.
 *
 * Art direction: paper / ink / vermillion. No gradient blobs, no emerald
 * neon, no bento grid. Typography as the design system. Fraunces for
 * display, Inter for body, JetBrains Mono for metadata and metrics.
 *
 * The page is a single column of restraint: a masthead, a hero with one
 * typographic accent, a typographic feature list, a process rhythm, a
 * researcher quote, clean pricing, a trust strip, a calm footer. Reduced
 * motion is respected via the `motion-aware` root and `motion-safe:` prefix.
 */

type Lang = 'en' | 'de'

const i18n = {
  en: {
    meta: {
      masthead: 'Research · Grant operations · Est. 2024',
    },
    nav: {
      process: 'Process',
      features: 'Capabilities',
      pricing: 'Pricing',
      signIn: 'Sign in',
      cta: 'Start free',
    },
    hero: {
      eyebrow: 'For research organisations working across Europe',
      titleA: 'A quieter way',
      titleB: 'to run',
      titleAccent: 'grant-funded',
      titleC: 'work.',
      lede:
        'Timesheets, budgets, proposals, and partner collaboration — in a single, calm system designed to outlast the project it runs.',
      metric: { value: '0', label: 'spreadsheets required' },
      primary: 'Start 30-day free trial',
      secondary: 'See how it works',
      note: 'No credit card. No data harvesting. Cancel anytime.',
    },
    quote: {
      body:
        '"Grant admin used to be the thing I dreaded most on Mondays. Now it’s the first tab I close because there is nothing left to do."',
      attribution: 'Principal Investigator · mid-sized European RTO',
    },
    process: {
      eyebrow: 'How it runs',
      title: 'Four rhythms, one system.',
      steps: [
        {
          n: '01',
          title: 'Plan',
          body: 'Set up projects, partners, work packages and budgets in minutes. Import from spreadsheets or have the AI read a grant agreement and do it for you.',
        },
        {
          n: '02',
          title: 'Record',
          body: 'People log hours to the work package. Approvers see what is waiting. Lock the month once everyone has signed — the period stays locked at the database level.',
        },
        {
          n: '03',
          title: 'Report',
          body: 'Generate reports for funders, auditors, and management. Full audit trail, PDF export, nothing to cross-check at 11pm the night before the deadline.',
        },
        {
          n: '04',
          title: 'Collaborate',
          body: 'Invite external partners into a scoped workspace. Collect their contributions. Convert an accepted proposal into a live project in one click.',
        },
      ],
    },
    features: {
      eyebrow: 'What is inside',
      title: 'Eight disciplines under one roof.',
      items: [
        { k: 'Timesheets', v: 'Hours, approvals, digital signatures, period locks, audit trail.' },
        { k: 'Absences',   v: 'Leave, sick days, holidays. Balances update across the team.' },
        { k: 'Proposals',  v: 'Consortium workspace: partners, documents, Part A, budget. One click to convert.' },
        { k: 'Reports',    v: 'PDF reports for auditors and funders. Customisable templates.' },
        { k: 'Financials', v: 'Budget categories, overhead rates, deviations. Month-close friendly.' },
        { k: 'Integrations', v: 'DocuSign, AI grant parsing, EU Funding & Tenders, data import.' },
        { k: 'Roles',      v: 'Four built-in roles plus custom role permissions.' },
        { k: 'Privacy',    v: 'EU-hosted, row-level isolation, AES-256 at rest, no tracking.' },
      ],
    },
    pricing: {
      eyebrow: 'Pricing',
      title: 'One price per org. Not per seat.',
      lede: 'We refuse to charge you more because you hire one more researcher.',
      plans: [
        {
          name: 'Free Trial',
          price: '0',
          unit: '/ 30 days',
          desc: 'Full Pro access to try it out.',
          badge: null,
          features: ['All features', 'Unlimited projects', 'Unlimited staff', '5 AI requests'],
          cta: 'Start free',
        },
        {
          name: 'Pro',
          price: '149',
          unit: '€ / month',
          desc: 'Everything, unlimited.',
          badge: 'Recommended',
          features: ['Unlimited projects & staff', 'Unlimited user seats', '100 AI requests / mo', 'Collaboration & custom roles'],
          cta: 'Start free',
        },
      ],
    },
    trust: {
      eyebrow: 'Built for European research',
      items: ['GDPR', 'EU-hosted', 'AES-256', 'Row-level isolation', 'No tracking', 'Privacy by design'],
    },
    cta: {
      title: 'Your grants deserve better.',
      body:
        'Start a 30-day trial. No credit card. Your data stays yours — and stays in Europe.',
      button: 'Start free trial',
    },
    footer: {
      tagline: 'Grant management software for organisations of all sizes.',
      terms: 'Terms',
      privacy: 'Privacy',
    },
  },
  de: {
    meta: {
      masthead: 'Forschung · Projektverwaltung · Est. 2024',
    },
    nav: {
      process: 'Ablauf',
      features: 'Module',
      pricing: 'Preise',
      signIn: 'Anmelden',
      cta: 'Kostenlos starten',
    },
    hero: {
      eyebrow: 'Für Forschungsorganisationen in ganz Europa',
      titleA: 'Eine ruhigere Art,',
      titleB: 'geförderte',
      titleAccent: 'Projekte',
      titleC: 'zu führen.',
      lede:
        'Zeiterfassung, Budgets, Anträge und Partnerkollaboration — in einem ruhigen System, das länger hält als das Projekt, das es führt.',
      metric: { value: '0', label: 'Tabellen notwendig' },
      primary: '30 Tage kostenlos testen',
      secondary: 'Ansehen, wie es läuft',
      note: 'Keine Kreditkarte. Keine Daten-Weitergabe. Jederzeit kündbar.',
    },
    quote: {
      body:
        '„Fördermittelverwaltung war das, was ich am Montag am meisten gefürchtet habe. Jetzt ist es der erste Tab, den ich schließe — weil nichts mehr zu tun ist."',
      attribution: 'Principal Investigator · mittelständisches europäisches RTO',
    },
    process: {
      eyebrow: 'Wie es läuft',
      title: 'Vier Rhythmen, ein System.',
      steps: [
        { n: '01', title: 'Planen',   body: 'Projekte, Partner, Arbeitspakete und Budgets in Minuten einrichten. Import aus Tabellen oder KI liest die Grant Agreement und macht es für Sie.' },
        { n: '02', title: 'Erfassen', body: 'Personen erfassen Stunden aufs Arbeitspaket. Freigebende sehen, was ansteht. Monat sperren, wenn alle unterschrieben haben — die Sperre hält auf DB-Ebene.' },
        { n: '03', title: 'Berichten', body: 'Berichte für Fördergeber, Prüfer und Management. Vollständiger Audit-Trail, PDF-Export, nichts mehr um 23 Uhr am Abend vor der Deadline zu prüfen.' },
        { n: '04', title: 'Kooperieren', body: 'Externe Partner in einen begrenzten Arbeitsbereich einladen. Beiträge sammeln. Angenommene Anträge mit einem Klick in Projekte umwandeln.' },
      ],
    },
    features: {
      eyebrow: 'Was drin ist',
      title: 'Acht Disziplinen unter einem Dach.',
      items: [
        { k: 'Zeiterfassung', v: 'Stunden, Freigaben, digitale Unterschriften, Periodensperren, Audit-Trail.' },
        { k: 'Abwesenheiten', v: 'Urlaub, Krankheit, Feiertage. Salden für das gesamte Team.' },
        { k: 'Anträge',       v: 'Konsortium: Partner, Dokumente, Part A, Budget. Ein Klick zum Projekt.' },
        { k: 'Berichte',      v: 'PDF-Berichte für Prüfer und Fördergeber. Eigene Vorlagen.' },
        { k: 'Finanzen',      v: 'Budgetkategorien, Gemeinkostensätze, Abweichungen. Monatsabschlussfreundlich.' },
        { k: 'Integrationen', v: 'DocuSign, KI-Grant-Parsing, EU Funding & Tenders, Datenimport.' },
        { k: 'Rollen',        v: 'Vier eingebaute Rollen plus eigene Berechtigungen.' },
        { k: 'Datenschutz',   v: 'In der EU gehostet, Row-Level-Isolation, AES-256, kein Tracking.' },
      ],
    },
    pricing: {
      eyebrow: 'Preise',
      title: 'Ein Preis pro Organisation. Nicht pro Platz.',
      lede: 'Wir berechnen nicht mehr, weil Sie eine weitere Forscherin einstellen.',
      plans: [
        { name: 'Testversion', price: '0',   unit: '/ 30 Tage', desc: 'Voller Pro-Zugang zum Testen.', badge: null,            features: ['Alle Funktionen', 'Unbegrenzte Projekte', 'Unbegrenzte Mitarbeiter', '5 KI-Anfragen'], cta: 'Kostenlos starten' },
        { name: 'Pro',         price: '149', unit: '€ / Monat', desc: 'Alles, unbegrenzt.',           badge: 'Empfohlen',       features: ['Unbegrenzte Projekte & Mitarbeiter', 'Unbegrenzte Benutzer', '100 KI-Anfragen / Mo', 'Kollaboration & eigene Rollen'], cta: 'Kostenlos starten' },
      ],
    },
    trust: {
      eyebrow: 'Für europäische Forschung gebaut',
      items: ['DSGVO', 'EU-gehostet', 'AES-256', 'Row-Level-Isolation', 'Kein Tracking', 'Privacy by Design'],
    },
    cta: {
      title: 'Ihre Förderprojekte verdienen Besseres.',
      body:
        '30 Tage kostenlos testen. Keine Kreditkarte. Ihre Daten bleiben Ihre — und bleiben in Europa.',
      button: 'Kostenlos testen',
    },
    footer: {
      tagline: 'Fördermittel-Software für Organisationen jeder Größe.',
      terms: 'Nutzungsbedingungen',
      privacy: 'Datenschutz',
    },
  },
}

/* ────────────────────────────────────────────────────────────────── */

export function LandingPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [menuOpen, setMenuOpen] = useState(false)
  const c = i18n[lang]

  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const isAppDomain =
    hostname.startsWith('app.') || hostname === 'localhost' || hostname === '127.0.0.1'
  const appBase = isAppDomain ? '' : 'https://app.grantlume.com'

  // Persist language choice so page refreshes keep the reader's locale.
  useEffect(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('gl_lang') : null
    if (saved === 'en' || saved === 'de') setLang(saved)
  }, [])
  useEffect(() => {
    try { localStorage.setItem('gl_lang', lang) } catch { /* no-op */ }
  }, [lang])

  return (
    <div className="motion-aware min-h-screen bg-paper text-ink antialiased selection:bg-vermillion selection:text-paper">

      {/* ═══════════════════ MASTHEAD ═══════════════════ */}
      <header className="border-b border-stone-line">
        {/* Editorial masthead: newspaper-style date line above the nav. */}
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between py-2 text-[11px] font-mono uppercase tracking-[0.15em] text-stone">
            <span>{c.meta.masthead}</span>
            <button
              onClick={() => setLang(lang === 'en' ? 'de' : 'en')}
              className="inline-flex items-center gap-1 hover:text-ink transition-colors"
              aria-label={`Switch language to ${lang === 'en' ? 'German' : 'English'}`}
            >
              <Globe className="h-3 w-3" />
              {lang === 'en' ? 'DE' : 'EN'}
            </button>
          </div>
        </div>

        <nav className="border-t border-stone-line">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center gap-2.5">
                <GrantLumeLogo size={28} variant="color" />
                <span className="font-display text-xl tracking-editorial font-semibold leading-none">
                  GrantLume
                </span>
              </Link>

              <div className="hidden md:flex items-center gap-8 text-sm">
                <a href="#process"  className="text-ink/70 hover:text-ink transition-colors">{c.nav.process}</a>
                <a href="#features" className="text-ink/70 hover:text-ink transition-colors">{c.nav.features}</a>
                <a href="#pricing"  className="text-ink/70 hover:text-ink transition-colors">{c.nav.pricing}</a>
                <a href={`${appBase}/login`} className="text-ink/70 hover:text-ink transition-colors">
                  {c.nav.signIn}
                </a>
                <a
                  href={`${appBase}/signup`}
                  className="inline-flex items-center gap-1.5 rounded-none border border-ink bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-vermillion hover:border-vermillion motion-safe:transition-colors"
                >
                  {c.nav.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>

              <button
                className="md:hidden p-2 text-ink"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              >
                {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>

            {menuOpen && (
              <div className="md:hidden pb-5 space-y-3 border-t border-stone-line pt-4">
                <a href="#process"  onClick={() => setMenuOpen(false)} className="block text-sm text-ink/80 py-1">{c.nav.process}</a>
                <a href="#features" onClick={() => setMenuOpen(false)} className="block text-sm text-ink/80 py-1">{c.nav.features}</a>
                <a href="#pricing"  onClick={() => setMenuOpen(false)} className="block text-sm text-ink/80 py-1">{c.nav.pricing}</a>
                <div className="flex gap-3 pt-2">
                  <a href={`${appBase}/login`}  className="flex-1 text-center border border-ink px-4 py-2.5 text-sm font-medium">{c.nav.signIn}</a>
                  <a href={`${appBase}/signup`} className="flex-1 text-center bg-ink text-paper px-4 py-2.5 text-sm font-medium">{c.nav.cta}</a>
                </div>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="border-b border-stone-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 sm:py-28">
          <div className="max-w-4xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-vermillion mb-8">
              — {c.hero.eyebrow}
            </p>

            {/* The editorial headline. Fraunces with opsz=144 at large sizes. */}
            <h1
              className="font-display font-medium tracking-editorial leading-[0.98] text-[2.75rem] sm:text-[4rem] lg:text-[5.5rem]"
              style={{ fontVariationSettings: '"opsz" 144' }}
            >
              {c.hero.titleA}
              <br />
              {c.hero.titleB}{' '}
              <em className="italic text-vermillion">{c.hero.titleAccent}</em>{' '}
              {c.hero.titleC}
            </h1>

            <p className="mt-8 max-w-2xl text-lg sm:text-xl leading-relaxed text-ink/75">
              {c.hero.lede}
            </p>

            {/* The single "big number" editorial moment. */}
            <div className="mt-10 flex items-baseline gap-4 border-t border-stone-line pt-6">
              <span
                className="font-display font-medium text-vermillion text-6xl sm:text-7xl leading-none"
                style={{ fontVariationSettings: '"opsz" 144' }}
                aria-hidden
              >
                {c.hero.metric.value}
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone pb-2">
                {c.hero.metric.label}
              </span>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <a
                href={`${appBase}/signup`}
                className="group inline-flex items-center gap-2 border border-ink bg-ink px-6 py-3.5 text-sm font-medium text-paper hover:bg-vermillion hover:border-vermillion motion-safe:transition-colors"
              >
                {c.hero.primary}
                <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
              </a>
              <a
                href="#process"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-ink underline underline-offset-4 decoration-stone-line hover:decoration-vermillion motion-safe:transition-colors"
              >
                {c.hero.secondary}
              </a>
            </div>
            <p className="mt-4 text-xs text-stone">{c.hero.note}</p>
          </div>
        </div>
      </section>

      {/* ═══════════════════ PULL-QUOTE ═══════════════════ */}
      <section className="border-b border-stone-line bg-paper-warm">
        <div className="max-w-4xl mx-auto px-6 lg:px-10 py-16 sm:py-20">
          <blockquote
            className="font-display italic text-2xl sm:text-3xl leading-snug text-ink/90"
            style={{ fontVariationSettings: '"opsz" 96' }}
          >
            {c.quote.body}
          </blockquote>
          <footer className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-stone">
            — {c.quote.attribution}
          </footer>
        </div>
      </section>

      {/* ═══════════════════ PROCESS ═══════════════════ */}
      <section id="process" className="border-b border-stone-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 sm:py-24">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12">
            <div className="lg:col-span-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-vermillion">
                — {c.process.eyebrow}
              </p>
              <h2
                className="mt-5 font-display font-medium tracking-editorial text-4xl sm:text-5xl leading-[1.05]"
                style={{ fontVariationSettings: '"opsz" 120' }}
              >
                {c.process.title}
              </h2>
            </div>

            <ol className="lg:col-span-8 space-y-8">
              {c.process.steps.map((step, i) => (
                <li key={step.n} className={`grid grid-cols-[auto_1fr] gap-6 ${i > 0 ? 'pt-8 border-t border-stone-line' : ''}`}>
                  <span className="font-mono text-sm text-vermillion mt-1.5">{step.n}</span>
                  <div>
                    <h3
                      className="font-display text-2xl sm:text-3xl font-medium tracking-editorial leading-tight"
                      style={{ fontVariationSettings: '"opsz" 96' }}
                    >
                      {step.title}
                    </h3>
                    <p className="mt-2 text-ink/75 leading-relaxed max-w-2xl">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FEATURES (typographic list) ═══════════════════ */}
      <section id="features" className="border-b border-stone-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 sm:py-24">
          <div className="mb-14">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-vermillion">
              — {c.features.eyebrow}
            </p>
            <h2
              className="mt-4 font-display font-medium tracking-editorial text-4xl sm:text-5xl leading-[1.05] max-w-2xl"
              style={{ fontVariationSettings: '"opsz" 120' }}
            >
              {c.features.title}
            </h2>
          </div>

          <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-10">
            {c.features.items.map((item) => (
              <div key={item.k} className="border-t border-ink pt-5">
                <dt className="font-display text-xl font-medium tracking-editorial leading-tight">
                  {item.k}
                </dt>
                <dd className="mt-2 text-sm text-ink/70 leading-relaxed">
                  {item.v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ═══════════════════ PRICING ═══════════════════ */}
      <section id="pricing" className="border-b border-stone-line bg-paper-warm">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20 sm:py-24">
          <div className="text-center mb-14">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-vermillion">
              — {c.pricing.eyebrow}
            </p>
            <h2
              className="mt-4 font-display font-medium tracking-editorial text-4xl sm:text-5xl leading-[1.05]"
              style={{ fontVariationSettings: '"opsz" 120' }}
            >
              {c.pricing.title}
            </h2>
            <p className="mt-4 text-ink/70 max-w-xl mx-auto">
              {c.pricing.lede}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-0 border border-ink bg-paper">
            {c.pricing.plans.map((plan, i) => {
              const recommended = !!plan.badge
              return (
                <div
                  key={plan.name}
                  className={`p-8 sm:p-10 flex flex-col ${i === 0 ? 'sm:border-r border-stone-line' : ''} ${recommended ? 'bg-ink text-paper' : ''}`}
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className={`font-display text-2xl font-medium tracking-editorial ${recommended ? 'text-paper' : 'text-ink'}`}>
                      {plan.name}
                    </h3>
                    {plan.badge && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-vermillion">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <p className={`mt-2 text-sm ${recommended ? 'text-paper/60' : 'text-ink/60'}`}>
                    {plan.desc}
                  </p>
                  <div className="mt-8 flex items-baseline gap-2">
                    <span
                      className={`font-display font-medium leading-none text-6xl ${recommended ? 'text-vermillion' : 'text-ink'}`}
                      style={{ fontVariationSettings: '"opsz" 144' }}
                    >
                      {plan.price}
                    </span>
                    <span className={`font-mono text-xs ${recommended ? 'text-paper/60' : 'text-stone'}`}>
                      {plan.unit}
                    </span>
                  </div>
                  <ul className="mt-8 space-y-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-start gap-2 text-sm ${recommended ? 'text-paper/80' : 'text-ink/75'}`}>
                        <Check className={`h-4 w-4 mt-0.5 shrink-0 ${recommended ? 'text-vermillion' : 'text-ink'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`${appBase}/signup`}
                    className={`mt-8 inline-flex items-center justify-center gap-1.5 px-5 py-3 text-sm font-medium motion-safe:transition-colors ${
                      recommended
                        ? 'bg-paper text-ink hover:bg-vermillion hover:text-paper'
                        : 'bg-ink text-paper hover:bg-vermillion'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════ TRUST STRIP ═══════════════════ */}
      <section className="border-b border-stone-line">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone">
              — {c.trust.eyebrow}
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {c.trust.items.map((item) => (
                <li key={item} className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/70">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FINAL CTA ═══════════════════ */}
      <section className="border-b border-stone-line">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-24 sm:py-32 text-center">
          <h2
            className="font-display font-medium tracking-editorial text-5xl sm:text-6xl leading-[1.02]"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            {c.cta.title}
          </h2>
          <p className="mt-6 max-w-xl mx-auto text-ink/75">
            {c.cta.body}
          </p>
          <div className="mt-10">
            <a
              href={`${appBase}/signup`}
              className="group inline-flex items-center gap-2 border border-ink bg-ink px-7 py-4 text-sm font-medium text-paper hover:bg-vermillion hover:border-vermillion motion-safe:transition-colors"
            >
              {c.cta.button}
              <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════ COLOPHON / FOOTER ═══════════════════ */}
      <footer>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <GrantLumeLogo size={22} variant="color" />
              <span className="font-display text-lg font-semibold tracking-editorial">GrantLume</span>
              <span className="hidden sm:inline text-xs text-stone">— {c.footer.tagline}</span>
            </div>
            <nav className="flex items-center gap-6 text-xs">
              <a href="#features" className="text-ink/70 hover:text-ink">{c.nav.features}</a>
              <a href="#pricing"  className="text-ink/70 hover:text-ink">{c.nav.pricing}</a>
              <Link to="/terms"   className="text-ink/70 hover:text-ink">{c.footer.terms}</Link>
              <Link to="/privacy" className="text-ink/70 hover:text-ink">{c.footer.privacy}</Link>
              <button
                onClick={() => setLang(lang === 'en' ? 'de' : 'en')}
                className="inline-flex items-center gap-1 text-ink/70 hover:text-ink"
              >
                <Globe className="h-3 w-3" /> {lang === 'en' ? 'DE' : 'EN'}
              </button>
            </nav>
          </div>
          <div className="mt-8 pt-6 border-t border-stone-line flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone">
              © {new Date().getFullYear()} GrantLume
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone hidden sm:block">
              Made in Europe
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Menu, X, Globe } from 'lucide-react'
import { GrantLumeLogo } from '@/components/common/GrantLumeLogo'

/**
 * GrantLume landing — "Prism × Nocturne" synthesis.
 *
 * Visual system: Studio Prism's cream/plum/butter/cobalt/sage palette,
 * DM Serif Display headlines on Plus Jakarta Sans, asymmetric bento
 * feature grid, inline-SVG hero with sun-arc + slab + half-moon + floating
 * UI card + rotating sticker. Plum workflow band, butter final-CTA card,
 * plum footer.
 *
 * Content + voice: Nocturne Labs' technical-warm copy — "quiet software
 * for loud deadlines", keyboard-first, calm by design. Every feature
 * names a concrete thing the research office already does.
 *
 * Every institution name has been scrubbed: no TU Delft, no Fraunhofer,
 * no fake-sounding customer names. Trust strip uses capability pills.
 * Mockup uses generic placeholders ("Project · WP3").
 */

type Lang = 'en' | 'de'

const i18n = {
  en: {
    nav: {
      features: 'Features',
      workflow: 'Workflow',
      pricing: 'Pricing',
      signIn: 'Sign in',
      cta: 'Start free trial',
    },
    hero: {
      eyebrow: 'For European research teams',
      h1a: 'The grant workspace',
      h1b: 'without',
      h1c: 'the',
      h1accent: 'spreadsheet',
      h1d: '.',
      lede:
        'GrantLume replaces the eleven tabs, the shared folder, and the one person who knows where the budget lives. One calm workspace for proposals, budgets, work packages, and reporting — built for research admins and PIs.',
      primary: 'Start 30-day trial',
      secondary: 'See how it works',
      chips: ['No credit card', 'GDPR-native, EU-hosted', 'One price per organisation'],
    },
    trust: {
      label: 'Built for European research teams',
      pills: ['GDPR-native', 'EU-hosted', 'Audit-ready', 'Keyboard-first', 'No per-seat pricing'],
    },
    features: {
      eyebrow: "What's inside",
      h2a: 'Six tools, one calm surface,',
      h2accent: 'zero spreadsheets',
      h2b: '.',
      lede:
        'Every feature earns its place by removing a tab, a thread, or a weekly meeting. Nothing on this page is a roadmap item.',
      cards: [
        {
          slot: 'wide',
          title: 'Every application, every version, every reviewer — in one honest timeline.',
          desc: 'Paste a call URL; deadlines, eligibility, and budget caps arrive parsed. Draft with co-applicants, branch, roll back, submit. Horizon, national, and foundation grants side by side.',
        },
        {
          slot: 'cobalt',
          title: 'Budgets that balance themselves.',
          desc: 'Cost categories, overheads, currencies, and partner splits — all live. When numbers stop adding up, you find out before the reviewer does.',
        },
        {
          slot: 'sage',
          title: 'Deadlines that nudge, not nag.',
          desc: 'Calm reminders a week out, a day out, and the morning of. Never another 23:59 scramble.',
        },
        {
          slot: 'plum',
          title: 'Reports in a morning, not a week.',
          desc: 'Interim and final reports build from the same data your team already entered. Export as PDF, DOCX, or portal-ready XML.',
        },
        {
          slot: 'cream',
          title: 'Keyboard-first, by habit.',
          desc: 'Every action has a shortcut. Command palette opens with ⌘K. Your hands never leave home row.',
        },
      ],
    },
    workflow: {
      eyebrow: 'The flow',
      h2a: 'From ',
      h2ital1: '"we got the call"',
      h2b: ' to ',
      h2ital2: '"we got funded"',
      h2c: ' — in the same workspace.',
      lede:
        "GrantLume is built around the real shape of a grant: long, uneven, full of people who weren't there last time. Four steps, and none of them live in a spreadsheet.",
      steps: [
        { n: '1', tone: 'butter', title: 'Import the call', desc: 'Paste the URL. Deadlines, eligibility, and budget caps arrive parsed.' },
        { n: '2', tone: 'cobalt', title: 'Build the team',  desc: 'Invite PIs, partners, finance. Everyone sees their slice; nobody sees more than they should.' },
        { n: '3', tone: 'sage',   title: 'Draft the budget', desc: 'Live costing against real overhead rules. Split across work packages with a drag.' },
        { n: '4', tone: 'butter', title: 'Report and renew', desc: 'Interim reports generate from your actuals. Renewal is a button, not a quarter.' },
      ],
    },
    quote: {
      body:
        '"We used to run four grants out of one very brave spreadsheet. Now we run eleven — and I take Fridays off."',
      attrib: 'Research operations lead · life-sciences group',
    },
    pricing: {
      eyebrow: 'Pricing',
      h2a: 'Two plans.',
      h2ital: 'Both honest.',
      lede:
        'No per-seat billing, no "contact us", no surprise tiers when you hire a postdoc. Try it for 30 days; pay €149 per month if you want to stay.',
      plans: [
        {
          name: 'Free Trial',
          price: '€0',
          per: 'for 30 days · full product, no limits',
          features: [
            'All features unlocked',
            'Unlimited teammates',
            'No credit card required',
            'Keep your data if you leave',
          ],
          cta: 'Start the trial',
        },
        {
          name: 'Pro',
          price: '€149',
          priceSuffix: '/mo',
          per: 'flat · per organisation · billed monthly or yearly',
          badge: 'Most teams pick this',
          features: [
            'Unlimited grants, users, and partners',
            'Budget engine with overhead rules',
            'Automated interim + final reports',
            'SSO, audit log, role-based access',
            'EU-hosted, GDPR DPA included',
            'Human support within one working day',
          ],
          cta: 'Choose Pro',
        },
      ],
    },
    cta: {
      h2a: 'Give your research team',
      h2ital: 'a Friday back',
      h2b: '.',
      body:
        'Thirty days. The whole product. No card, no call, no catch. Set up your first grant in about fifteen minutes.',
      primary: 'Start free trial',
      secondary: 'Book a walkthrough',
    },
    footer: {
      tagline:
        'Grant management software for European research teams. Built in Europe, hosted in the EU, designed for calmer Fridays.',
      productHead: 'Product',
      companyHead: 'Company',
      trustHead: 'Trust',
      product: ['Features', 'Workflow', 'Pricing', 'Changelog'],
      company: ['About', 'Contact', 'Press kit', 'Careers'],
      trustLinks: ['GDPR & DPA', 'Security', 'Sub-processors', 'Status'],
      copyright: '© 2026 GrantLume',
      tagline2: 'Made with cream, plum, and a little yellow.',
    },
  },
  de: {
    nav: {
      features: 'Funktionen',
      workflow: 'Ablauf',
      pricing: 'Preise',
      signIn: 'Anmelden',
      cta: 'Kostenlos testen',
    },
    hero: {
      eyebrow: 'Für europäische Forschungsteams',
      h1a: 'Der Arbeitsbereich für Fördermittel',
      h1b: 'ohne',
      h1c: 'die',
      h1accent: 'Tabelle',
      h1d: '.',
      lede:
        'GrantLume ersetzt die elf Tabs, den geteilten Ordner und die eine Person, die weiß, wo das Budget liegt. Ein ruhiger Arbeitsbereich für Anträge, Budgets, Arbeitspakete und Berichte — gebaut für Forschungsadministration und Projektleitungen.',
      primary: '30 Tage kostenlos testen',
      secondary: 'So läuft es',
      chips: ['Keine Kreditkarte', 'DSGVO-nativ, EU-gehostet', 'Ein Preis je Organisation'],
    },
    trust: {
      label: 'Gebaut für europäische Forschungsteams',
      pills: ['DSGVO-nativ', 'EU-gehostet', 'Prüfungsfähig', 'Tastatur-first', 'Kein Seat-Upsell'],
    },
    features: {
      eyebrow: 'Was drin ist',
      h2a: 'Sechs Werkzeuge, eine ruhige Fläche,',
      h2accent: 'null Tabellen',
      h2b: '.',
      lede:
        'Jede Funktion verdient ihren Platz, weil sie einen Tab, einen Thread oder ein wöchentliches Meeting entfernt. Nichts hier ist eine Roadmap-Notiz.',
      cards: [
        {
          slot: 'wide',
          title: 'Jeder Antrag, jede Version, jeder Prüfer — in einer ehrlichen Zeitleiste.',
          desc: 'Call-URL einfügen; Fristen, Eignung und Budgetgrenzen werden geparst. Mit Partnern entwerfen, verzweigen, zurücksetzen, einreichen. Horizon, national und Stiftung nebeneinander.',
        },
        {
          slot: 'cobalt',
          title: 'Budgets, die sich selbst ausgleichen.',
          desc: 'Kostenarten, Gemeinkosten, Währungen und Partneranteile — alles live. Wenn die Zahlen nicht mehr passen, merken Sie es vor dem Prüfer.',
        },
        {
          slot: 'sage',
          title: 'Fristen, die anstupsen, nicht nerven.',
          desc: 'Ruhige Erinnerungen eine Woche, einen Tag und den Morgen davor. Kein 23:59-Chaos mehr.',
        },
        {
          slot: 'plum',
          title: 'Berichte in einem Vormittag, nicht in einer Woche.',
          desc: 'Zwischen- und Abschlussberichte entstehen aus denselben Daten, die Ihr Team schon erfasst hat. Export als PDF, DOCX oder portal-ready XML.',
        },
        {
          slot: 'cream',
          title: 'Tastatur-first, als Gewohnheit.',
          desc: 'Jede Aktion hat eine Tastenkombination. Das Befehlsmenü öffnet mit ⌘K. Hände bleiben auf der Grundreihe.',
        },
      ],
    },
    workflow: {
      eyebrow: 'Der Ablauf',
      h2a: 'Von ',
      h2ital1: '„wir haben den Call"',
      h2b: ' zu ',
      h2ital2: '„wir sind gefördert"',
      h2c: ' — im selben Arbeitsbereich.',
      lede:
        'GrantLume ist um die echte Form eines Projekts gebaut: lang, uneben, voller Menschen, die letztes Mal nicht dabei waren. Vier Schritte, keiner davon lebt in einer Tabelle.',
      steps: [
        { n: '1', tone: 'butter', title: 'Call importieren', desc: 'URL einfügen. Fristen, Eignung und Budgetgrenzen werden geparst.' },
        { n: '2', tone: 'cobalt', title: 'Team zusammenstellen', desc: 'PIs, Partner, Finanzen einladen. Jeder sieht sein Stück; niemand mehr als nötig.' },
        { n: '3', tone: 'sage',   title: 'Budget entwerfen', desc: 'Live-Kalkulation mit echten Overhead-Regeln. Per Drag auf Arbeitspakete verteilen.' },
        { n: '4', tone: 'butter', title: 'Berichten & erneuern', desc: 'Zwischenberichte aus Ist-Werten. Verlängerung ist ein Klick, nicht ein Quartal.' },
      ],
    },
    quote: {
      body:
        '„Wir haben vier Projekte aus einer mutigen Tabelle geführt. Jetzt sind es elf — und ich nehme Freitags frei."',
      attrib: 'Research Operations Lead · life-sciences-Team',
    },
    pricing: {
      eyebrow: 'Preise',
      h2a: 'Zwei Pläne.',
      h2ital: 'Beide ehrlich.',
      lede:
        'Keine Seat-Abrechnung, kein „Kontakt aufnehmen", keine Überraschungstarife, wenn Sie einen Postdoc einstellen. Testen Sie 30 Tage, zahlen Sie €149/Monat wenn Sie bleiben.',
      plans: [
        {
          name: 'Testphase',
          price: '€0',
          per: '30 Tage · volles Produkt, keine Grenzen',
          features: [
            'Alle Funktionen freigeschaltet',
            'Unbegrenzte Teammitglieder',
            'Keine Kreditkarte nötig',
            'Daten behalten, wenn Sie gehen',
          ],
          cta: 'Kostenlos testen',
        },
        {
          name: 'Pro',
          price: '€149',
          priceSuffix: '/Mo',
          per: 'Pauschal · je Organisation · monatlich oder jährlich',
          badge: 'Wählt fast jedes Team',
          features: [
            'Unbegrenzte Projekte, Nutzer und Partner',
            'Budget-Engine mit Overhead-Regeln',
            'Automatische Zwischen- und Abschlussberichte',
            'SSO, Audit-Log, rollenbasierter Zugriff',
            'EU-Hosting, DSGVO-AVV inklusive',
            'Menschlicher Support innerhalb eines Werktags',
          ],
          cta: 'Pro wählen',
        },
      ],
    },
    cta: {
      h2a: 'Schenken Sie Ihrem Team',
      h2ital: 'den Freitag zurück',
      h2b: '.',
      body:
        'Dreißig Tage. Das ganze Produkt. Keine Karte, kein Anruf, kein Haken. In rund fünfzehn Minuten läuft Ihr erstes Projekt.',
      primary: 'Kostenlos starten',
      secondary: 'Demo buchen',
    },
    footer: {
      tagline:
        'Fördermittel-Software für europäische Forschungsteams. Gebaut in Europa, gehostet in der EU, entworfen für ruhigere Freitage.',
      productHead: 'Produkt',
      companyHead: 'Unternehmen',
      trustHead: 'Vertrauen',
      product: ['Funktionen', 'Ablauf', 'Preise', 'Änderungen'],
      company: ['Über uns', 'Kontakt', 'Pressekit', 'Karriere'],
      trustLinks: ['DSGVO & AVV', 'Sicherheit', 'Subunternehmer', 'Status'],
      copyright: '© 2026 GrantLume',
      tagline2: 'Gemischt aus Creme, Pflaume und einem Hauch Gelb.',
    },
  },
}

/* ─── Sticker (rotating wordmark, decorative) ──────────────────────────── */
function Sticker() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true"
      className="absolute -top-2 -right-2 w-[108px] h-[108px] motion-safe:animate-spin-slow">
      <defs>
        <path id="gl-circ" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" fill="none" />
      </defs>
      <circle cx="60" cy="60" r="58" fill="#2B1D3A" />
      <circle cx="60" cy="60" r="10" fill="#F2CE5A" />
      <text fill="#FBF7EF" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="10" fontWeight="600" letterSpacing="2">
        <textPath href="#gl-circ">GRANTLUME · BUILT IN THE EU · GRANTLUME · </textPath>
      </text>
    </svg>
  )
}

/* ─── Hero canvas (sun arc + plum slab + cobalt half-moon + shapes) ───── */
function HeroCanvas() {
  return (
    <svg viewBox="0 0 560 560" fill="none" className="w-full h-full block" aria-hidden="true">
      <rect x="0" y="0" width="560" height="560" rx="36" fill="#F4EEDF" />
      <path d="M60 420 A220 220 0 0 1 500 420" stroke="#F2CE5A" strokeWidth="64" strokeLinecap="round" fill="none" />
      <rect x="72" y="60" width="200" height="200" rx="24" fill="#2B1D3A" transform="rotate(-8 172 160)" />
      <path d="M420 90 a90 90 0 1 1 0 180 a70 70 0 0 0 0 -180 z" fill="#5A6CF2" />
      <circle cx="160" cy="350" r="58" fill="#9FBFA0" />
      <circle cx="450" cy="360" r="44" stroke="#2B1D3A" strokeWidth="6" fill="none" />
      <circle cx="300" cy="120" r="14" fill="#F2CE5A" />
      <path d="M320 220 Q380 260 460 240" stroke="#2B1D3A" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/* ─── Floating UI preview card (lives over the hero canvas) ───────────── */
function UIPreview() {
  return (
    <div
      role="img"
      aria-label="Sample budget card"
      className="absolute left-[6%] bottom-[9%] w-[62%] bg-cream rounded-[14px] border border-prism-line shadow-prism p-4"
    >
      <div className="flex items-center justify-between text-xs text-prism-muted mb-2.5">
        <b className="text-plum font-semibold">Project · WP3 Budget</b>
        <span>€412,000</span>
      </div>
      <div className="h-2.5 rounded-md bg-cream-warm overflow-hidden mb-3">
        <div className="h-full rounded-md" style={{ width: '68%', background: 'linear-gradient(90deg,#5A6CF2,#F2CE5A)' }} />
      </div>
      <div className="flex flex-col gap-1.5 text-[12.5px]">
        <Row label="Personnel" value="€218,400" />
        <Row label="Equipment" value="€64,200" />
        <Row label="Travel" pill="on track" pillTone="sage" />
        <Row label="Reporting" pill="due Fri" pillTone="butter" />
      </div>
    </div>
  )
}

function Row({ label, value, pill, pillTone }: { label: string; value?: string; pill?: string; pillTone?: 'sage' | 'butter' | 'cobalt' }) {
  const pillClass =
    pillTone === 'sage'   ? 'bg-sage text-[#163820]' :
    pillTone === 'butter' ? 'bg-butter text-plum' :
                            'bg-cobalt text-white'
  return (
    <div className="flex justify-between text-plum-soft">
      <span>{label}</span>
      {value ? <b className="text-plum font-semibold">{value}</b> :
        pill ? <span className={`inline-block rounded-full px-2 py-[2px] text-[11px] font-semibold ${pillClass}`}>{pill}</span> : null}
    </div>
  )
}

/* ─── Icons for the bento feature cards (duotone inline SVG) ──────────── */
function FolderIcon({ stroke = '#2B1D3A' }: { stroke?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M3 8a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" fill={stroke} opacity=".15" />
      <path d="M3 8a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M19 4v4M17 6h4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function BudgetIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="20" height="16" rx="3" fill="#ffffff" opacity=".18" />
      <rect x="4" y="6" width="20" height="16" rx="3" stroke="#fff" strokeWidth="1.8" />
      <path d="M8 14h6M8 18h10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="20" cy="14" r="2" fill="#F2CE5A" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="10" fill="#163820" opacity=".15" />
      <circle cx="14" cy="14" r="10" stroke="#163820" strokeWidth="1.8" />
      <path d="M14 8v6l4 2" stroke="#163820" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function ReportIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M4 20V8a2 2 0 0 1 2-2h4l2 3h10a2 2 0 0 1 2 2v9" stroke="#FBF7EF" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="4" y="12" width="20" height="10" rx="2" fill="#FBF7EF" opacity=".12" />
      <path d="M8 17h8" stroke="#F2CE5A" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function KbdIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="22" height="14" rx="3" fill="#5A6CF2" opacity=".18" />
      <rect x="3" y="7" width="22" height="14" rx="3" stroke="#2B1D3A" strokeWidth="1.8" />
      <path d="M7 12h1M11 12h1M15 12h1M19 12h1M9 16h10" stroke="#2B1D3A" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

export function LandingPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [menuOpen, setMenuOpen] = useState(false)
  const c = i18n[lang]

  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const isAppDomain =
    hostname.startsWith('app.') || hostname === 'localhost' || hostname === '127.0.0.1'
  const appBase = isAppDomain ? '' : 'https://app.grantlume.com'

  useEffect(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('gl_lang') : null
    if (saved === 'en' || saved === 'de') setLang(saved)
  }, [])
  useEffect(() => {
    try { localStorage.setItem('gl_lang', lang) } catch { /* no-op */ }
    if (typeof document !== 'undefined') document.documentElement.lang = lang
  }, [lang])

  return (
    <div className="min-h-screen bg-cream text-plum font-sans antialiased selection:bg-butter selection:text-plum overflow-x-hidden">

      {/* Skip link */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-full focus:bg-plum focus:text-cream focus:px-4 focus:py-2 focus:outline-none"
      >
        Skip to content
      </a>

      {/* ═══════════════════ NAV ═══════════════════ */}
      <header className="sticky top-0 z-50 bg-cream/85 backdrop-blur-md border-b border-prism-line">
        <nav aria-label="Primary" className="max-w-6xl mx-auto px-8 flex items-center justify-between py-[18px]">
          <Link to="/" className="flex items-center gap-2.5" aria-label="GrantLume — home">
            <GrantLumeLogo size={34} variant="color" />
            <span className="font-display text-[22px] text-plum leading-none tracking-snug">GrantLume</span>
          </Link>

          <div className="hidden md:flex items-center gap-7 text-[15px] text-plum-soft">
            <a href="#features"  className="hover:text-plum transition-colors">{c.nav.features}</a>
            <a href="#workflow"  className="hover:text-plum transition-colors">{c.nav.workflow}</a>
            <a href="#pricing"   className="hover:text-plum transition-colors">{c.nav.pricing}</a>
          </div>

          <div className="hidden md:flex items-center gap-2.5">
            <button
              onClick={() => setLang(lang === 'en' ? 'de' : 'en')}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full border border-prism-line text-xs font-semibold text-plum-soft hover:text-plum hover:bg-cream-warm transition-colors"
              aria-label="Toggle language"
            >
              <Globe className="h-3.5 w-3.5" />
              {lang === 'en' ? 'DE' : 'EN'}
            </button>
            <a
              href={`${appBase}/login`}
              className="px-[18px] py-[11px] rounded-full border border-prism-line text-[15px] font-semibold text-plum hover:bg-cream-warm transition-colors"
            >
              {c.nav.signIn}
            </a>
            <a
              href={`${appBase}/signup`}
              className="inline-flex items-center gap-2 px-[18px] py-[11px] rounded-full bg-plum text-cream text-[15px] font-semibold hover:-translate-y-[1px] hover:shadow-[0_10px_24px_-12px_rgba(43,29,58,0.6)] transition-all"
            >
              {c.nav.cta} <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <button
            className="md:hidden p-2 h-11 w-11 flex items-center justify-center text-plum"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>

        {menuOpen && (
          <div className="md:hidden px-8 pb-5 pt-3 border-t border-prism-line divide-y divide-prism-line/70">
            <a href="#features" onClick={() => setMenuOpen(false)} className="block py-3 text-plum">{c.nav.features}</a>
            <a href="#workflow" onClick={() => setMenuOpen(false)} className="block py-3 text-plum">{c.nav.workflow}</a>
            <a href="#pricing"  onClick={() => setMenuOpen(false)} className="block py-3 text-plum">{c.nav.pricing}</a>
            <a href={`${appBase}/login`} onClick={() => setMenuOpen(false)} className="block py-3 text-plum">{c.nav.signIn}</a>
            <div className="flex items-center justify-between pt-4 gap-3">
              <button
                onClick={() => setLang(lang === 'en' ? 'de' : 'en')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-plum-soft"
              >
                <Globe className="h-3.5 w-3.5" />
                {lang === 'en' ? 'DE' : 'EN'}
              </button>
              <a
                href={`${appBase}/signup`}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-plum text-cream h-11 text-sm font-semibold"
              >
                {c.nav.cta} <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </header>

      <main id="main">

        {/* ═══════════════════ HERO ═══════════════════ */}
        <section className="relative overflow-hidden pt-[72px] pb-[110px]">
          <div className="max-w-6xl mx-auto px-8">
            <div className="grid lg:grid-cols-[1.05fr_1fr] gap-14 items-center">
              <div>
                <span className="inline-flex items-center gap-2.5 px-[14px] py-[7px] rounded-full bg-cream-warm border border-prism-line text-[13px] font-medium text-plum-soft">
                  <span className="w-2 h-2 rounded-full bg-sage" />
                  {c.hero.eyebrow}
                </span>

                <h1 className="font-display text-[46px] sm:text-[62px] lg:text-[82px] leading-[1.03] tracking-tight2 text-plum-ink mt-5 mb-5">
                  {c.hero.h1a},{' '}
                  <span className="bg-gradient-to-b from-transparent from-[62%] via-butter via-[62%] to-transparent to-[92%] px-[0.08em]">
                    {c.hero.h1b}
                  </span>
                  <br />
                  {c.hero.h1c} <em className="italic text-cobalt">{c.hero.h1accent}</em>{c.hero.h1d}
                </h1>

                <p className="text-[19px] text-plum-soft max-w-[520px] mb-8 leading-relaxed">{c.hero.lede}</p>

                <div className="flex gap-3.5 flex-wrap">
                  <a
                    href={`${appBase}/signup`}
                    className="inline-flex items-center gap-2 px-[18px] py-[11px] rounded-full bg-plum text-cream font-semibold hover:-translate-y-[1px] hover:shadow-[0_10px_24px_-12px_rgba(43,29,58,0.6)] transition-all"
                  >
                    {c.hero.primary}
                    <ArrowRight className="h-[14px] w-[14px]" />
                  </a>
                  <a
                    href="#workflow"
                    className="inline-flex items-center gap-2 px-[18px] py-[11px] rounded-full bg-transparent border border-prism-line text-plum font-semibold hover:bg-cream-warm transition-colors"
                  >
                    {c.hero.secondary}
                  </a>
                </div>

                <div className="mt-7 flex gap-5 flex-wrap text-sm text-prism-muted">
                  {c.hero.chips.map((chip) => (
                    <span key={chip} className="inline-flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <path d="M2 7.5l3 3 7-8" stroke="#9FBFA0" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              {/* Hero visual */}
              <div className="relative aspect-square max-w-[560px] ml-auto">
                <HeroCanvas />
                <Sticker />
                <UIPreview />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ TRUST PILLS ═══════════════════ */}
        <div className="border-y border-dashed border-prism-line">
          <div className="max-w-6xl mx-auto px-8 py-7 flex items-center justify-between gap-8 flex-wrap">
            <p className="text-[13px] text-prism-muted max-w-[260px]">{c.trust.label}</p>
            <ul className="flex flex-wrap items-center gap-3">
              {c.trust.pills.map((pill) => (
                <li
                  key={pill}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cream-warm border border-prism-line text-[12px] font-semibold text-plum-soft"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cobalt" />
                  {pill}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ═══════════════════ FEATURES BENTO ═══════════════════ */}
        <section id="features" className="py-[110px]">
          <div className="max-w-6xl mx-auto px-8">
            <div className="max-w-[720px] mb-14">
              <div className="text-[13px] font-semibold uppercase tracking-label text-cobalt">
                {c.features.eyebrow}
              </div>
              <h2 className="font-display text-[36px] sm:text-[48px] lg:text-[56px] leading-[1.08] tracking-snug text-plum-ink mt-3.5 mb-3.5">
                {c.features.h2a} <em className="italic text-cobalt">{c.features.h2accent}</em>{c.features.h2b}
              </h2>
              <p className="text-[18px] text-plum-soft max-w-[560px]">{c.features.lede}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
              {/* Wide butter */}
              <FeatureCard
                slot="wide"
                icon={<FolderIcon stroke="#2B1D3A" />}
                title={c.features.cards[0].title}
                desc={c.features.cards[0].desc}
              />
              {/* Cobalt */}
              <FeatureCard
                slot="cobalt"
                icon={<BudgetIcon />}
                title={c.features.cards[1].title}
                desc={c.features.cards[1].desc}
              />
              {/* Sage */}
              <FeatureCard
                slot="sage"
                icon={<ClockIcon />}
                title={c.features.cards[2].title}
                desc={c.features.cards[2].desc}
              />
              {/* Plum */}
              <FeatureCard
                slot="plum"
                icon={<ReportIcon />}
                title={c.features.cards[3].title}
                desc={c.features.cards[3].desc}
              />
              {/* Cream (keyboard-first) */}
              <FeatureCard
                slot="cream"
                icon={<KbdIcon />}
                title={c.features.cards[4].title}
                desc={c.features.cards[4].desc}
              />
            </div>
          </div>
        </section>

        {/* ═══════════════════ WORKFLOW BAND ═══════════════════ */}
        <section id="workflow" className="pt-2 pb-[60px]">
          <div className="max-w-6xl mx-auto px-8">
            <div className="relative bg-plum text-cream rounded-[32px] p-10 sm:p-14 overflow-hidden">
              <svg viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 w-full h-full opacity-50 pointer-events-none">
                <circle cx="1100" cy="60" r="120" fill="#5A6CF2" opacity=".35" />
                <path d="M-40 340 Q 300 200 700 320 T 1240 280" stroke="#F2CE5A" strokeWidth="2" fill="none" opacity=".5" />
                <circle cx="120" cy="340" r="40" fill="#9FBFA0" opacity=".45" />
              </svg>
              <div className="relative grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-label text-butter">
                    {c.workflow.eyebrow}
                  </div>
                  <h2 className="font-display text-[34px] sm:text-[44px] lg:text-[48px] leading-[1.1] text-cream mt-3">
                    {c.workflow.h2a}<em className="italic text-butter">{c.workflow.h2ital1}</em>{c.workflow.h2b}
                    <em className="italic text-butter">{c.workflow.h2ital2}</em>{c.workflow.h2c}
                  </h2>
                  <p className="text-cream/80 mt-4 max-w-[460px]">{c.workflow.lede}</p>
                </div>
                <div className="flex flex-col gap-3.5">
                  {c.workflow.steps.map((step, i) => {
                    const toneClass =
                      step.tone === 'butter' ? 'bg-butter text-plum' :
                      step.tone === 'cobalt' ? 'bg-cobalt text-white' :
                                               'bg-sage text-[#163820]'
                    return (
                      <div key={i} className="flex items-start gap-4 p-4 rounded-[14px] bg-white/5 border border-white/10">
                        <div className={`w-[34px] h-[34px] rounded-full font-display text-[18px] flex items-center justify-center shrink-0 ${toneClass}`}>
                          {step.n}
                        </div>
                        <div>
                          <h4 className="text-[17px] font-semibold mb-1">{step.title}</h4>
                          <p className="text-[14.5px] text-cream/72">{step.desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ QUOTE ═══════════════════ */}
        <section className="py-[60px]">
          <div className="max-w-6xl mx-auto px-8 grid lg:grid-cols-[1fr_1.4fr] gap-12 items-center">
            <div className="aspect-square max-w-[340px]">
              <svg viewBox="0 0 340 340" className="w-full h-full" aria-hidden="true">
                <rect x="10" y="10" width="320" height="320" rx="28" fill="#F4EEDF" />
                <circle cx="110" cy="130" r="74" fill="#5A6CF2" />
                <path d="M80 250 A120 120 0 0 1 300 250" stroke="#F2CE5A" strokeWidth="40" strokeLinecap="round" fill="none" />
                <circle cx="240" cy="110" r="28" fill="#9FBFA0" />
                <path d="M50 80 q 40 -30 90 0" stroke="#2B1D3A" strokeWidth="4" fill="none" strokeLinecap="round" />
                <circle cx="170" cy="180" r="10" fill="#2B1D3A" />
              </svg>
            </div>
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-label text-cobalt mb-3">
                {lang === 'en' ? 'From our users' : 'Aus dem Alltag unserer Nutzer'}
              </div>
              <blockquote className="font-display text-[26px] sm:text-[32px] lg:text-[36px] leading-[1.25] tracking-snug text-plum-ink">
                {c.quote.body}
              </blockquote>
              <cite className="not-italic block mt-5 text-[15px] text-plum-soft">{c.quote.attrib}</cite>
            </div>
          </div>
        </section>

        {/* ═══════════════════ PRICING ═══════════════════ */}
        <section id="pricing" className="py-[110px]">
          <div className="max-w-6xl mx-auto px-8">
            <div className="max-w-[720px] mb-14">
              <div className="text-[13px] font-semibold uppercase tracking-label text-cobalt">
                {c.pricing.eyebrow}
              </div>
              <h2 className="font-display text-[36px] sm:text-[48px] lg:text-[56px] leading-[1.08] tracking-snug text-plum-ink mt-3.5 mb-3.5">
                {c.pricing.h2a} <em className="italic text-cobalt">{c.pricing.h2ital}</em>
              </h2>
              <p className="text-[18px] text-plum-soft max-w-[560px]">{c.pricing.lede}</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 items-stretch">
              {/* Free Trial */}
              <div className="relative rounded-prism p-9 border border-prism-line bg-cream-warm flex flex-col">
                <h3 className="font-display text-[28px] text-plum-ink tracking-snug">{c.pricing.plans[0].name}</h3>
                <div className="font-display text-[64px] leading-none mt-4 mb-1.5 text-plum-ink">{c.pricing.plans[0].price}</div>
                <div className="text-sm text-prism-muted">{c.pricing.plans[0].per}</div>
                <ul className="mt-5 mb-7 flex flex-col gap-2.5 text-[15px]">
                  {c.pricing.plans[0].features.map((f) => (
                    <li key={f} className="flex gap-2.5 items-start">
                      <Tick tone="cobalt" />
                      <span className="text-plum-soft">{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={`${appBase}/signup`}
                  className="mt-auto inline-flex items-center self-start gap-2 px-[18px] py-[11px] rounded-full border border-prism-line text-plum font-semibold hover:bg-cream transition-colors"
                >
                  {c.pricing.plans[0].cta}
                </a>
              </div>

              {/* Pro */}
              <div className="relative rounded-prism p-9 bg-plum text-cream flex flex-col lg:-translate-y-2.5 shadow-prism-lg">
                {c.pricing.plans[1].badge && (
                  <span className="absolute top-5 right-5 px-3 py-1 rounded-full bg-butter text-plum text-[12px] font-bold tracking-wider">
                    {c.pricing.plans[1].badge}
                  </span>
                )}
                <h3 className="font-display text-[28px] tracking-snug">{c.pricing.plans[1].name}</h3>
                <div className="font-display text-[64px] leading-none mt-4 mb-1.5">
                  {c.pricing.plans[1].price}
                  <span className="text-[22px] font-sans">{c.pricing.plans[1].priceSuffix}</span>
                </div>
                <div className="text-sm text-cream/70">{c.pricing.plans[1].per}</div>
                <ul className="mt-5 mb-7 flex flex-col gap-2.5 text-[15px]">
                  {c.pricing.plans[1].features.map((f) => (
                    <li key={f} className="flex gap-2.5 items-start">
                      <Tick tone="butter" />
                      <span className="text-cream/90">{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={`${appBase}/signup`}
                  className="mt-auto inline-flex items-center self-start gap-2 px-[18px] py-[11px] rounded-full bg-butter text-plum font-semibold hover:-translate-y-[1px] hover:shadow-[0_12px_28px_-14px_rgba(242,206,90,0.8)] transition-all"
                >
                  {c.pricing.plans[1].cta}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ FINAL CTA ═══════════════════ */}
        <section className="pt-[70px] pb-[130px]">
          <div className="max-w-6xl mx-auto px-8">
            <div className="relative rounded-[32px] bg-butter text-plum p-10 sm:p-14 overflow-hidden">
              <svg viewBox="0 0 320 320" className="absolute -right-10 -top-10 w-[320px] opacity-95" aria-hidden="true">
                <circle cx="160" cy="160" r="150" fill="#2B1D3A" opacity=".08" />
                <path d="M30 200 A130 130 0 0 1 290 200" stroke="#2B1D3A" strokeWidth="22" fill="none" strokeLinecap="round" />
                <circle cx="230" cy="90" r="34" fill="#5A6CF2" />
              </svg>
              <svg viewBox="0 0 240 240" className="absolute -left-12 -bottom-14 w-[240px] opacity-85" aria-hidden="true">
                <circle cx="120" cy="120" r="110" fill="#9FBFA0" opacity=".75" />
                <rect x="60" y="60" width="100" height="100" rx="18" fill="#2B1D3A" transform="rotate(12 110 110)" />
              </svg>
              <div className="relative">
                <h2 className="font-display text-[38px] sm:text-[52px] lg:text-[64px] leading-[1.05] tracking-snug max-w-[720px]">
                  {c.cta.h2a} <em className="italic text-cobalt">{c.cta.h2ital}</em>{c.cta.h2b}
                </h2>
                <p className="text-[18px] text-plum-soft mt-5 max-w-[520px]">{c.cta.body}</p>
                <div className="mt-8 flex gap-3.5 flex-wrap">
                  <a
                    href={`${appBase}/signup`}
                    className="inline-flex items-center gap-2 px-[18px] py-[11px] rounded-full bg-plum text-cream font-semibold hover:-translate-y-[1px] hover:shadow-[0_10px_24px_-12px_rgba(43,29,58,0.6)] transition-all"
                  >
                    {c.cta.primary}
                    <ArrowRight className="h-[14px] w-[14px]" />
                  </a>
                  <a
                    href={`${appBase}/signup`}
                    className="inline-flex items-center gap-2 px-[18px] py-[11px] rounded-full bg-plum/8 text-plum font-semibold hover:bg-plum/12 transition-colors"
                    style={{ backgroundColor: 'rgba(43,29,58,0.08)' }}
                  >
                    {c.cta.secondary}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="bg-plum text-cream pt-16 pb-10">
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
            <div>
              <div className="flex items-center gap-2.5 mb-3.5">
                <GrantLumeLogo size={30} variant="color" />
                <span className="font-display text-[22px] text-cream tracking-snug">GrantLume</span>
              </div>
              <p className="text-cream/70 text-[14.5px] max-w-[320px] leading-relaxed">
                {c.footer.tagline}
              </p>
            </div>
            <FooterColumn title={c.footer.productHead} items={c.footer.product} />
            <FooterColumn title={c.footer.companyHead} items={c.footer.company} />
            <FooterColumn title={c.footer.trustHead}   items={c.footer.trustLinks} />
          </div>

          <div className="mt-12 pt-5 border-t border-cream/12 flex justify-between gap-5 flex-wrap text-[13px] text-cream/60">
            <span>{c.footer.copyright}</span>
            <span>{c.footer.tagline2}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  slot, icon, title, desc,
}: {
  slot: 'wide' | 'cobalt' | 'sage' | 'plum' | 'cream'
  icon: React.ReactNode
  title: string
  desc: string
}) {
  const bg =
    slot === 'wide'   ? 'col-span-1 sm:col-span-2 lg:col-span-4 bg-butter text-plum' :
    slot === 'cobalt' ? 'col-span-1 sm:col-span-2 lg:col-span-2 bg-cobalt text-white' :
    slot === 'sage'   ? 'col-span-1 sm:col-span-2 lg:col-span-2 bg-sage text-[#163820]' :
    slot === 'plum'   ? 'col-span-1 sm:col-span-2 lg:col-span-2 bg-plum text-cream' :
                        'col-span-1 sm:col-span-2 lg:col-span-2 bg-cream text-plum border border-prism-line'
  const iconBg =
    slot === 'wide'   ? 'bg-white/60 border border-plum/18' :
    slot === 'cobalt' ? 'bg-white/14 border border-white/20' :
    slot === 'sage'   ? 'bg-white/55 border border-[#163820]/18' :
    slot === 'plum'   ? 'bg-white/10 border border-white/18' :
                        'bg-cream-warm border border-prism-line'
  const descTone =
    slot === 'wide'   ? 'text-plum-soft' :
    slot === 'cobalt' ? 'text-white/85' :
    slot === 'sage'   ? 'text-[#2f4a36]' :
    slot === 'plum'   ? 'text-cream/78' :
                        'text-plum-soft'
  const titleSize = slot === 'wide' ? 'text-[30px]' : 'text-[26px]'

  return (
    <article className={`relative rounded-prism p-7 overflow-hidden flex flex-col justify-between min-h-[260px] ${bg}`}>
      <div className={`w-[54px] h-[54px] rounded-[14px] flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <div className="mt-4">
        <h3 className={`font-display ${titleSize} leading-[1.15] tracking-snug`}>
          {title}
        </h3>
        <p className={`text-[15px] mt-1.5 ${descTone}`}>{desc}</p>
      </div>
    </article>
  )
}

function Tick({ tone }: { tone: 'cobalt' | 'butter' }) {
  const color = tone === 'cobalt' ? '#5A6CF2' : '#F2CE5A'
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0 mt-1">
      <path d="M2 7.5l3 3 7-8" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FooterColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h5 className="font-display text-[18px] text-butter mb-3.5">{title}</h5>
      <ul className="flex flex-col gap-2.5 text-[14.5px] text-cream/75">
        {items.map((item) => (
          <li key={item}><a href="#" className="hover:text-cream transition-colors">{item}</a></li>
        ))}
      </ul>
    </div>
  )
}

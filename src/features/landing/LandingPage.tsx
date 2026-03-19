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
  Sparkles,
  Shield,
  BarChart3,
  FileText,
  Handshake,
  Workflow,
  Bot,
  Moon,
  Bell,
  Languages,
  Import,
} from 'lucide-react'
import { GrantLumeLogo } from '@/components/common/GrantLumeLogo'

type Lang = 'en' | 'de'

/* ─── Translations ─── */
const i18n = {
  en: {
    nav: { features: 'Features', pricing: 'Pricing', login: 'Sign in', tryFree: 'Start Free' },
    hero: {
      pill: 'Trusted by research teams across Europe',
      h1: 'Grant management,',
      h1Accent: 'finally simple.',
      sub: 'Projects, budgets, timesheets, and partner collaboration — one platform built for the way research organisations actually work.',
      cta: 'Start 14-day free trial',
      ctaNote: 'No credit card required',
      login: 'Sign in',
    },
    stats: [
      { value: '6', label: 'Core modules' },
      { value: '5', label: 'Languages' },
      { value: '100%', label: 'GDPR compliant' },
      { value: '<2 min', label: 'Setup time' },
    ],
    features: {
      title: 'Everything your team needs',
      sub: 'Six integrated modules that replace spreadsheets, emails, and guesswork.',
      cards: [
        { icon: 'Lightbulb', title: 'Proposals', desc: 'Track ideas to funded projects. Convert with one click.' },
        { icon: 'FolderKanban', title: 'Projects', desc: 'Work packages, milestones, deliverables, Gantt timelines.' },
        { icon: 'CalendarDays', title: 'Allocations', desc: 'Person-month planning. Plan vs actual. Spot over-commitments.' },
        { icon: 'ClipboardCheck', title: 'Timesheets', desc: 'Submit, approve, lock. Full workflow with digital signatures.' },
        { icon: 'DollarSign', title: 'Financials', desc: 'Budget vs actuals by category. Expense tracking in real time.' },
        { icon: 'Users', title: 'Collaboration', desc: 'Invite partners. Collect reports. Track deviations together.' },
      ],
    },
    extras: {
      title: 'Plus',
      items: [
        { icon: 'Bot', label: 'AI document parsing' },
        { icon: 'FileText', label: 'PDF reports' },
        { icon: 'Workflow', label: 'Role permissions' },
        { icon: 'Bell', label: 'Notifications' },
        { icon: 'Languages', label: '5 languages' },
        { icon: 'Import', label: 'Data import' },
        { icon: 'BarChart3', label: 'Analytics' },
        { icon: 'Moon', label: 'Dark mode' },
      ],
    },
    pricing: {
      title: 'One price per org. Not per seat.',
      plans: [
        { name: 'Trial', price: '0', unit: '/ 14 days', desc: 'Full access to try it out', badge: '', features: ['All features', '3 projects', '5 staff', '2 users'] },
        { name: 'Starter', price: '49', unit: '€/mo', desc: 'Small research groups', badge: 'Popular', features: ['10 projects', '20 staff', '5 users', '20 AI parses/mo'] },
        { name: 'Growth', price: '99', unit: '€/mo', desc: 'Departments & partners', badge: '', features: ['Unlimited projects', 'Unlimited staff', '20 users', 'Collaboration module'] },
      ],
      enterprise: 'Need 50+ users?',
      enterpriseCta: 'Contact us',
      cta: 'Start free',
    },
    trust: {
      title: 'Built for European research',
      badges: ['GDPR', 'EU-hosted', 'AES-256', 'Row-level isolation', 'No tracking', 'Privacy by design'],
    },
    cta: {
      title: 'Your grants deserve better.',
      button: 'Start your free trial',
      note: 'No credit card · Cancel anytime',
    },
    footer: {
      tagline: 'Grant management for research organisations.',
      product: 'Product',
      legal: 'Legal',
      terms: 'Terms',
      privacy: 'Privacy',
      copy: '© 2025 GrantLume',
    },
  },
  de: {
    nav: { features: 'Funktionen', pricing: 'Preise', login: 'Anmelden', tryFree: 'Testen' },
    hero: {
      pill: 'Vertraut von Forschungsteams in ganz Europa',
      h1: 'Fördermittelmanagement,',
      h1Accent: 'endlich einfach.',
      sub: 'Projekte, Budgets, Zeiterfassung und Partnerkooperationen — eine Plattform, die so funktioniert, wie Forschungsorganisationen tatsächlich arbeiten.',
      cta: '14 Tage kostenlos testen',
      ctaNote: 'Keine Kreditkarte erforderlich',
      login: 'Anmelden',
    },
    stats: [
      { value: '6', label: 'Kernmodule' },
      { value: '5', label: 'Sprachen' },
      { value: '100%', label: 'DSGVO-konform' },
      { value: '<2 Min', label: 'Einrichtung' },
    ],
    features: {
      title: 'Alles, was Ihr Team braucht',
      sub: 'Sechs integrierte Module, die Tabellen, E-Mails und Rätselraten ersetzen.',
      cards: [
        { icon: 'Lightbulb', title: 'Anträge', desc: 'Von der Idee zum Projekt. Ein Klick zur Umwandlung.' },
        { icon: 'FolderKanban', title: 'Projekte', desc: 'Arbeitspakete, Meilensteine, Deliverables, Gantt-Diagramme.' },
        { icon: 'CalendarDays', title: 'Zuweisungen', desc: 'Personenmonate planen. Plan vs. Ist vergleichen.' },
        { icon: 'ClipboardCheck', title: 'Zeiterfassung', desc: 'Einreichen, genehmigen, sperren. Digitale Unterschriften.' },
        { icon: 'DollarSign', title: 'Finanzen', desc: 'Budget vs. Ist nach Kategorie. Ausgaben in Echtzeit.' },
        { icon: 'Users', title: 'Kollaboration', desc: 'Partner einladen. Berichte sammeln. Gemeinsam verfolgen.' },
      ],
    },
    extras: {
      title: 'Außerdem',
      items: [
        { icon: 'Bot', label: 'KI-Dokumentenanalyse' },
        { icon: 'FileText', label: 'PDF-Berichte' },
        { icon: 'Workflow', label: 'Rollenberechtigungen' },
        { icon: 'Bell', label: 'Benachrichtigungen' },
        { icon: 'Languages', label: '5 Sprachen' },
        { icon: 'Import', label: 'Datenimport' },
        { icon: 'BarChart3', label: 'Analytik' },
        { icon: 'Moon', label: 'Dark Mode' },
      ],
    },
    pricing: {
      title: 'Ein Preis pro Organisation. Nicht pro Benutzer.',
      plans: [
        { name: 'Test', price: '0', unit: '/ 14 Tage', desc: 'Voller Zugang zum Testen', badge: '', features: ['Alle Funktionen', '3 Projekte', '5 Mitarbeiter', '2 Benutzer'] },
        { name: 'Starter', price: '49', unit: '€/Monat', desc: 'Kleine Forschungsgruppen', badge: 'Beliebt', features: ['10 Projekte', '20 Mitarbeiter', '5 Benutzer', '20 KI-Analysen/Mo'] },
        { name: 'Growth', price: '99', unit: '€/Monat', desc: 'Abteilungen & Partner', badge: '', features: ['Unbegrenzte Projekte', 'Unbegrenzte Mitarbeiter', '20 Benutzer', 'Kollaborationsmodul'] },
      ],
      enterprise: '50+ Benutzer?',
      enterpriseCta: 'Kontaktieren Sie uns',
      cta: 'Kostenlos starten',
    },
    trust: {
      title: 'Für europäische Forschung entwickelt',
      badges: ['DSGVO', 'EU-gehostet', 'AES-256', 'Row-Level-Isolation', 'Kein Tracking', 'Privacy by Design'],
    },
    cta: {
      title: 'Ihre Förderprojekte verdienen Besseres.',
      button: 'Jetzt kostenlos testen',
      note: 'Keine Kreditkarte · Jederzeit kündbar',
    },
    footer: {
      tagline: 'Fördermittel-Software für Forschungsorganisationen.',
      product: 'Produkt',
      legal: 'Rechtliches',
      terms: 'Nutzungsbedingungen',
      privacy: 'Datenschutz',
      copy: '© 2025 GrantLume',
    },
  },
}

/* ─── Icon map ─── */
const icons: Record<string, React.ElementType> = {
  FolderKanban, Users, CalendarDays, ClipboardCheck, DollarSign, Lightbulb,
  BarChart3, FileText, Handshake, Workflow, Bot, Moon, Bell, Languages, Import,
}

/* ─── Decorative blobs ─── */
function HeroBlobs() {
  return (
    <>
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-500/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-blue-500/15 to-indigo-400/10 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-amber-300/10 blur-3xl" />
    </>
  )
}

/* ─── Visual: fake dashboard mockup ─── */
function DashboardVisual() {
  return (
    <div className="relative mx-auto mt-12 max-w-4xl">
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f1729] via-transparent to-transparent z-10 rounded-2xl" />
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-1 shadow-2xl shadow-emerald-500/10">
        <div className="rounded-xl bg-[#111827] overflow-hidden">
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="bg-white/5 rounded-md px-4 py-1 text-[10px] text-white/30 font-mono">app.grantlume.com</div>
            </div>
          </div>
          {/* Content */}
          <div className="p-5 sm:p-8 space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Active Projects', val: '12', color: 'from-emerald-500 to-teal-600' },
                { label: 'Staff Allocated', val: '38', color: 'from-blue-500 to-indigo-600' },
                { label: 'Budget Used', val: '67%', color: 'from-amber-500 to-orange-600' },
                { label: 'Timesheets', val: '94%', color: 'from-violet-500 to-purple-600' },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <div className={`text-lg sm:text-2xl font-bold bg-gradient-to-r ${kpi.color} bg-clip-text text-transparent`}>{kpi.val}</div>
                  <div className="text-[10px] sm:text-xs text-white/40 mt-0.5">{kpi.label}</div>
                </div>
              ))}
            </div>
            {/* Chart placeholder rows */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 rounded-lg bg-white/[0.03] border border-white/[0.06] p-4 h-28 sm:h-36">
                <div className="text-[10px] text-white/30 mb-3">Budget Overview</div>
                <div className="flex items-end gap-1.5 h-16 sm:h-20">
                  {[40, 65, 50, 80, 60, 90, 70, 55, 85, 45, 75, 95].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-emerald-500/60 to-emerald-400/20" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-4 h-28 sm:h-36">
                <div className="text-[10px] text-white/30 mb-3">Allocation</div>
                <div className="flex items-center justify-center h-16 sm:h-20">
                  <svg viewBox="0 0 36 36" className="w-16 h-16 sm:w-20 sm:h-20">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke="url(#ring)" strokeWidth="3" strokeDasharray="67 33" strokeLinecap="round" transform="rotate(-90 18 18)" />
                    <defs><linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient></defs>
                    <text x="18" y="19.5" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">67%</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Bento feature card with colored accent ─── */
const CARD_COLORS = [
  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
]

/* ════════════════════════════════════════════════════
   LANDING PAGE
   ════════════════════════════════════════════════════ */
export function LandingPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const c = i18n[lang]

  const hostname = window.location.hostname
  const isAppDomain = hostname.startsWith('app.') || hostname === 'localhost' || hostname === '127.0.0.1'
  const appBase = isAppDomain ? '' : 'https://app.grantlume.com'

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white antialiased overflow-x-hidden">

      {/* ══════════ NAV ══════════ */}
      <nav className="sticky top-0 z-50 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <GrantLumeLogo size={30} variant="dark" />
              <span className="text-lg font-bold tracking-tight">
                <span className="text-white">Grant</span>
                <span className="text-emerald-400">Lume</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-7">
              <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors">{c.nav.features}</a>
              <a href="#pricing" className="text-sm text-white/50 hover:text-white transition-colors">{c.nav.pricing}</a>
              <button onClick={() => setLang(lang === 'en' ? 'de' : 'en')} className="flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors">
                <Globe className="h-3.5 w-3.5" />
                {lang === 'en' ? 'DE' : 'EN'}
              </button>
              <a href={`${appBase}/login`} className="text-sm font-medium text-white/70 hover:text-white transition-colors">{c.nav.login}</a>
              <a
                href={`${appBase}/signup`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
              >
                {c.nav.tryFree}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="md:hidden flex items-center gap-2">
              <button onClick={() => setLang(lang === 'en' ? 'de' : 'en')} className="p-2 text-white/40"><Globe className="h-5 w-5" /></button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white/70">
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-3 border-t border-white/5 pt-4">
              <a href="#features" className="block text-sm text-white/60 py-1" onClick={() => setMobileMenuOpen(false)}>{c.nav.features}</a>
              <a href="#pricing" className="block text-sm text-white/60 py-1" onClick={() => setMobileMenuOpen(false)}>{c.nav.pricing}</a>
              <div className="flex gap-3 pt-2">
                <a href={`${appBase}/login`} className="flex-1 text-center rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/80">{c.nav.login}</a>
                <a href={`${appBase}/signup`} className="flex-1 text-center rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white">{c.nav.tryFree}</a>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section className="relative pt-16 pb-4 sm:pt-24 sm:pb-8">
        <HeroBlobs />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            {/* Social proof pill */}
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-xs font-medium text-white/60 mb-8">
              <div className="flex -space-x-1.5">
                {['bg-emerald-400','bg-blue-400','bg-amber-400','bg-violet-400'].map((c,i) => (
                  <div key={i} className={`w-5 h-5 rounded-full ${c} border-2 border-[#0a0f1e] flex items-center justify-center text-[7px] font-bold text-white/90`}>
                    {['U','R','T','H'][i]}
                  </div>
                ))}
              </div>
              {c.hero.pill}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.1]">
              {c.hero.h1}
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                {c.hero.h1Accent}
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-white/50 leading-relaxed max-w-2xl mx-auto">
              {c.hero.sub}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={`${appBase}/signup`}
                className="group inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-white hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/25 hover:shadow-emerald-400/30"
              >
                {c.hero.cta}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a href={`${appBase}/login`} className="text-sm font-medium text-white/40 hover:text-white/70 transition-colors">
                {c.hero.login} →
              </a>
            </div>
            <p className="mt-3 text-xs text-white/30">{c.hero.ctaNote}</p>
          </div>

          {/* Dashboard visual */}
          <DashboardVisual />
        </div>
      </section>

      {/* ══════════ STATS BAR ══════════ */}
      <section className="py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0 sm:divide-x divide-white/5">
            {c.stats.map((s, i) => (
              <div key={i} className="text-center px-4">
                <div className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">{s.value}</div>
                <div className="text-xs text-white/40 mt-1 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FEATURES — Bento Grid ══════════ */}
      <section id="features" className="py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{c.features.title}</h2>
            <p className="mt-3 text-sm sm:text-base text-white/40 max-w-lg mx-auto">{c.features.sub}</p>
          </div>

          {/* Bento 2-col + 3-col layout */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.features.cards.map((card, i) => {
              const Icon = icons[card.icon] || FolderKanban
              const color = CARD_COLORS[i % CARD_COLORS.length]
              return (
                <div
                  key={i}
                  className={`group relative rounded-2xl border ${color.border} bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-all duration-300`}
                >
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${color.bg} ${color.text} mb-3`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white">{card.title}</h3>
                  <p className="mt-1.5 text-sm text-white/40 leading-relaxed">{card.desc}</p>
                </div>
              )
            })}
          </div>

          {/* Extras strip */}
          <div className="mt-8 rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4">
            <span className="text-xs font-semibold text-white/30 uppercase tracking-wider mr-4">{c.extras.title}</span>
            <div className="inline-flex flex-wrap gap-3 mt-2 sm:mt-0">
              {c.extras.items.map((item, i) => {
                const Icon = icons[item.icon] || Sparkles
                return (
                  <span key={i} className="inline-flex items-center gap-1.5 text-xs text-white/50">
                    <Icon className="h-3 w-3 text-emerald-400/60" />
                    {item.label}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ PRICING ══════════ */}
      <section id="pricing" className="py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center mb-10">{c.pricing.title}</h2>

          <div className="grid sm:grid-cols-3 gap-4">
            {c.pricing.plans.map((plan, i) => {
              const isPopular = !!plan.badge
              return (
                <div
                  key={i}
                  className={`relative rounded-2xl p-5 flex flex-col transition-all duration-300 ${
                    isPopular
                      ? 'bg-gradient-to-b from-emerald-500/10 to-emerald-500/5 border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                      : 'border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                      {plan.badge}
                    </div>
                  )}
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-white/70">{plan.name}</h3>
                    <p className="text-xs text-white/30 mt-0.5">{plan.desc}</p>
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold text-white">{plan.price === '0' ? '0' : plan.price}</span>
                    <span className="text-sm text-white/30 ml-1">{plan.unit}</span>
                  </div>
                  <ul className="space-y-2 mb-5 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-xs text-white/50">
                        <Check className={`h-3 w-3 shrink-0 ${isPopular ? 'text-emerald-400' : 'text-white/20'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`${appBase}/signup`}
                    className={`block w-full text-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                      isPopular
                        ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {c.pricing.cta}
                  </a>
                </div>
              )
            })}
          </div>

          <p className="text-center mt-6 text-xs text-white/30">
            {c.pricing.enterprise}{' '}
            <a href="mailto:hello@grantlume.com" className="font-semibold text-emerald-400 hover:underline">{c.pricing.enterpriseCta}</a>
          </p>
        </div>
      </section>

      {/* ══════════ TRUST STRIP ══════════ */}
      <section className="py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-5">
            <Shield className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">{c.trust.title}</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {c.trust.badges.map((badge, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] px-3.5 py-1.5 text-xs text-white/40">
                <Check className="h-3 w-3 text-emerald-400/50" />
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section className="py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600/20 via-teal-600/10 to-cyan-600/20 border border-emerald-500/20 px-8 py-12 sm:px-14 sm:py-14 text-center">
            <div className="absolute inset-0">
              <div className="absolute top-0 left-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight max-w-md mx-auto">
                {c.cta.title}
              </h2>
              <div className="mt-7">
                <a
                  href={`${appBase}/signup`}
                  className="group inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 text-sm font-semibold text-white hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/25"
                >
                  {c.cta.button}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>
              <p className="mt-3 text-xs text-white/30">{c.cta.note}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <GrantLumeLogo size={24} variant="dark" />
                <span className="text-sm font-bold tracking-tight">
                  <span className="text-white/80">Grant</span>
                  <span className="text-emerald-400">Lume</span>
                </span>
              </div>
              <span className="text-xs text-white/20 hidden sm:inline">{c.footer.tagline}</span>
            </div>
            <div className="flex items-center gap-5 text-xs text-white/30">
              <a href="#features" className="hover:text-white/60 transition-colors">{c.nav.features}</a>
              <a href="#pricing" className="hover:text-white/60 transition-colors">{c.nav.pricing}</a>
              <Link to="/terms" className="hover:text-white/60 transition-colors">{c.footer.terms}</Link>
              <Link to="/privacy" className="hover:text-white/60 transition-colors">{c.footer.privacy}</Link>
              <button onClick={() => setLang(lang === 'en' ? 'de' : 'en')} className="flex items-center gap-1 hover:text-white/60 transition-colors">
                <Globe className="h-3 w-3" />{lang === 'en' ? 'DE' : 'EN'}
              </button>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <p className="text-[10px] text-white/15">{c.footer.copy}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

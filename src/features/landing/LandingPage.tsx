import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardCheck,
  CalendarOff,
  Lightbulb,
  FileText,
  Globe,
  Plug,
  ArrowRight,
  Check,
  Menu,
  X,
  Sparkles,
  Shield,
  BarChart3,
  Workflow,
  Bot,
  Bell,
  Languages,
  Import,
  Users,
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
      cta: 'Start 30-day free trial',
      ctaNote: 'No credit card required',
      login: 'Sign in',
    },
    stats: [
      { value: '6', label: 'Core modules' },
      { value: '100%', label: 'GDPR compliant' },
      { value: '<2 min', label: 'Setup time' },
      { value: '∞', label: 'Unlimited users' },
    ],
    features: {
      title: 'Built for the way research teams work',
      sub: 'Integrated modules that replace spreadsheets, scattered emails, and manual processes.',
      cards: [
        { icon: 'ClipboardCheck', title: 'Timesheets', desc: 'Submit, approve, and lock hours. Full audit trail with digital and manual signatures.' },
        { icon: 'CalendarOff', title: 'Absences', desc: 'Track leave, sickness, and holidays. Balances update automatically across the team.' },
        { icon: 'Lightbulb', title: 'Proposal Management', desc: 'From first draft to submission. Manage the full proposal lifecycle in one place.' },
        { icon: 'FileText', title: 'Reports', desc: 'Beautiful, customisable reports. Generate PDFs for auditors, funders, and management.' },
        { icon: 'Plug', title: 'Integrations', desc: 'DocuSign signatures, AI document parsing, data import, and EU project databases.' },
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
      ],
    },
    pricing: {
      title: 'One price per org. Not per seat.',
      plans: [
        { name: 'Free Trial', price: '0', unit: '/ 30 days', desc: 'Full Pro access to try it out', badge: '', features: ['All features', 'Unlimited projects', 'Unlimited staff', '5 AI requests'] },
        { name: 'Pro', price: '149', unit: '€/mo', desc: 'Everything, unlimited', badge: 'Recommended', features: ['Unlimited projects & staff', 'Unlimited user seats', '100 AI requests/mo', 'Collaboration & custom roles'] },
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
      cta: '30 Tage kostenlos testen',
      ctaNote: 'Keine Kreditkarte erforderlich',
      login: 'Anmelden',
    },
    stats: [
      { value: '6', label: 'Kernmodule' },
      { value: '100%', label: 'DSGVO-konform' },
      { value: '<2 Min', label: 'Einrichtung' },
      { value: '∞', label: 'Unbegrenzte Benutzer' },
    ],
    features: {
      title: 'Für die Arbeitsweise von Forschungsteams gebaut',
      sub: 'Integrierte Module, die Tabellen, verstreute E-Mails und manuelle Prozesse ersetzen.',
      cards: [
        { icon: 'ClipboardCheck', title: 'Zeiterfassung', desc: 'Stunden einreichen, genehmigen und sperren. Vollständiger Audit-Trail mit digitalen Unterschriften.' },
        { icon: 'CalendarOff', title: 'Abwesenheiten', desc: 'Urlaub, Krankheit und Feiertage erfassen. Salden aktualisieren sich automatisch.' },
        { icon: 'Lightbulb', title: 'Antragsverwaltung', desc: 'Vom ersten Entwurf bis zur Einreichung. Den gesamten Lebenszyklus an einem Ort.' },
        { icon: 'FileText', title: 'Berichte', desc: 'Schöne, anpassbare Berichte. PDFs für Prüfer, Fördergeber und Management.' },
        { icon: 'Plug', title: 'Integrationen', desc: 'DocuSign-Signaturen, KI-Dokumentenanalyse, Datenimport und EU-Projektdatenbanken.' },
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
      ],
    },
    pricing: {
      title: 'Ein Preis pro Organisation. Nicht pro Benutzer.',
      plans: [
        { name: 'Testversion', price: '0', unit: '/ 30 Tage', desc: 'Voller Pro-Zugang zum Testen', badge: '', features: ['Alle Funktionen', 'Unbegrenzte Projekte', 'Unbegrenzte Mitarbeiter', '5 KI-Anfragen'] },
        { name: 'Pro', price: '149', unit: '€/Monat', desc: 'Alles, unbegrenzt', badge: 'Empfohlen', features: ['Unbegrenzte Projekte & Mitarbeiter', 'Unbegrenzte Benutzer', '100 KI-Anfragen/Mo', 'Kollaboration & eigene Rollen'] },
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
  ClipboardCheck, CalendarOff, Lightbulb, FileText, Plug, Users,
  BarChart3, Workflow, Bot, Bell, Languages, Import,
}

/* ─── Decorative blobs (light) ─── */
function HeroBlobs() {
  return (
    <>
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-emerald-100/60 to-teal-50/40 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-blue-100/40 to-indigo-50/30 blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-amber-50/40 blur-3xl" />
    </>
  )
}

/* ─── Visual: fake dashboard mockup (light) ─── */
function DashboardVisual() {
  return (
    <div className="relative mx-auto mt-12 max-w-4xl">
      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 rounded-2xl" />
      <div className="rounded-2xl border border-gray-200 bg-white p-1 shadow-2xl shadow-gray-200/60">
        <div className="rounded-xl bg-gray-50 overflow-hidden">
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="bg-gray-100 rounded-md px-4 py-1 text-[10px] text-gray-400 font-mono">app.grantlume.com</div>
            </div>
          </div>
          {/* Content */}
          <div className="p-5 sm:p-8 space-y-4 bg-white">
            {/* KPI row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Active Projects', val: '12', color: 'text-emerald-600' },
                { label: 'Staff Allocated', val: '38', color: 'text-blue-600' },
                { label: 'Budget Used', val: '67%', color: 'text-amber-600' },
                { label: 'Timesheets', val: '94%', color: 'text-violet-600' },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                  <div className={`text-lg sm:text-2xl font-bold ${kpi.color}`}>{kpi.val}</div>
                  <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{kpi.label}</div>
                </div>
              ))}
            </div>
            {/* Chart placeholder rows */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 rounded-lg bg-gray-50 border border-gray-100 p-4 h-28 sm:h-36">
                <div className="text-[10px] text-gray-400 mb-3">Budget Overview</div>
                <div className="flex items-end gap-1.5 h-16 sm:h-20">
                  {[40, 65, 50, 80, 60, 90, 70, 55, 85, 45, 75, 95].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-emerald-500 to-emerald-300" style={{ height: `${h}%`, opacity: 0.7 }} />
                  ))}
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 h-28 sm:h-36">
                <div className="text-[10px] text-gray-400 mb-3">Allocation</div>
                <div className="flex items-center justify-center h-16 sm:h-20">
                  <svg viewBox="0 0 36 36" className="w-16 h-16 sm:w-20 sm:h-20">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke="url(#ring)" strokeWidth="3" strokeDasharray="67 33" strokeLinecap="round" transform="rotate(-90 18 18)" />
                    <defs><linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient></defs>
                    <text x="18" y="19.5" textAnchor="middle" fill="#1f2937" fontSize="7" fontWeight="bold">67%</text>
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

/* ─── Bento feature card with colored accent (light) ─── */
const CARD_COLORS = [
  { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200/60' },
  { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200/60' },
  { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200/60' },
  { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200/60' },
  { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200/60' },
  { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200/60' },
]

/* ════════════════════════════════════════════════════
   LANDING PAGE — Light theme
   ════════════════════════════════════════════════════ */
export function LandingPage() {
  const [lang, setLang] = useState<Lang>('en')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const c = i18n[lang]

  const hostname = window.location.hostname
  const isAppDomain = hostname.startsWith('app.') || hostname === 'localhost' || hostname === '127.0.0.1'
  const appBase = isAppDomain ? '' : 'https://app.grantlume.com'

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased overflow-x-hidden">

      {/* ══════════ NAV ══════════ */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <GrantLumeLogo size={30} variant="color" />
              <span className="text-lg font-bold tracking-tight">
                <span className="text-gray-900">Grant</span>
                <span className="text-emerald-600">Lume</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-7">
              <a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{c.nav.features}</a>
              <a href="#pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{c.nav.pricing}</a>
              <button onClick={() => setLang(lang === 'en' ? 'de' : 'en')} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                <Globe className="h-3.5 w-3.5" />
                {lang === 'en' ? 'DE' : 'EN'}
              </button>
              <a href={`${appBase}/login`} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">{c.nav.login}</a>
              <a
                href={`${appBase}/signup`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors shadow-md shadow-emerald-600/20"
              >
                {c.nav.tryFree}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="md:hidden flex items-center gap-2">
              <button onClick={() => setLang(lang === 'en' ? 'de' : 'en')} className="p-2 text-gray-400"><Globe className="h-5 w-5" /></button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-600">
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-3 border-t border-gray-100 pt-4">
              <a href="#features" className="block text-sm text-gray-500 py-1" onClick={() => setMobileMenuOpen(false)}>{c.nav.features}</a>
              <a href="#pricing" className="block text-sm text-gray-500 py-1" onClick={() => setMobileMenuOpen(false)}>{c.nav.pricing}</a>
              <div className="flex gap-3 pt-2">
                <a href={`${appBase}/login`} className="flex-1 text-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700">{c.nav.login}</a>
                <a href={`${appBase}/signup`} className="flex-1 text-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">{c.nav.tryFree}</a>
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
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200/60 px-4 py-1.5 text-xs font-medium text-emerald-700 mb-8">
              <div className="flex -space-x-1.5">
                {['bg-emerald-500','bg-blue-500','bg-amber-500','bg-violet-500'].map((bg,i) => (
                  <div key={i} className={`w-5 h-5 rounded-full ${bg} border-2 border-white flex items-center justify-center text-[7px] font-bold text-white`}>
                    {['U','R','T','H'][i]}
                  </div>
                ))}
              </div>
              {c.hero.pill}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.1] text-gray-900">
              {c.hero.h1}
              <br />
              <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                {c.hero.h1Accent}
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
              {c.hero.sub}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={`${appBase}/signup`}
                className="group inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 hover:shadow-emerald-500/25"
              >
                {c.hero.cta}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a href={`${appBase}/login`} className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">
                {c.hero.login} →
              </a>
            </div>
            <p className="mt-3 text-xs text-gray-400">{c.hero.ctaNote}</p>
          </div>

          {/* Dashboard visual */}
          <DashboardVisual />
        </div>
      </section>

      {/* ══════════ STATS BAR ══════════ */}
      <section className="py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0 sm:divide-x divide-gray-100">
            {c.stats.map((s, i) => (
              <div key={i} className="text-center px-4">
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">{s.value}</div>
                <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FEATURES — Bento Grid ══════════ */}
      <section id="features" className="py-14 sm:py-20 bg-gray-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">{c.features.title}</h2>
            <p className="mt-3 text-sm sm:text-base text-gray-500 max-w-lg mx-auto">{c.features.sub}</p>
          </div>

          {/* Bento 2-col + 3-col layout */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.features.cards.map((card, i) => {
              const Icon = icons[card.icon] || ClipboardCheck
              const color = CARD_COLORS[i % CARD_COLORS.length]
              return (
                <div
                  key={i}
                  className={`group relative rounded-2xl border ${color.border} bg-white p-5 hover:shadow-lg hover:shadow-gray-100 transition-all duration-300`}
                >
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${color.bg} ${color.text} mb-3`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{card.title}</h3>
                  <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{card.desc}</p>
                </div>
              )
            })}
          </div>

          {/* Extras strip */}
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white px-5 py-4">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-4">{c.extras.title}</span>
            <div className="inline-flex flex-wrap gap-3 mt-2 sm:mt-0">
              {c.extras.items.map((item, i) => {
                const Icon = icons[item.icon] || Sparkles
                return (
                  <span key={i} className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <Icon className="h-3 w-3 text-emerald-500" />
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
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center text-gray-900 mb-10">{c.pricing.title}</h2>

          <div className="grid sm:grid-cols-3 gap-4">
            {c.pricing.plans.map((plan, i) => {
              const isPopular = !!plan.badge
              return (
                <div
                  key={i}
                  className={`relative rounded-2xl p-5 flex flex-col transition-all duration-300 ${
                    isPopular
                      ? 'bg-gradient-to-b from-emerald-50 to-white border-2 border-emerald-300 shadow-lg shadow-emerald-100/50'
                      : 'border border-gray-200 bg-white hover:shadow-md hover:shadow-gray-100'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                      {plan.badge}
                    </div>
                  )}
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-600">{plan.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{plan.desc}</p>
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold text-gray-900">{plan.price === '0' ? '0' : plan.price}</span>
                    <span className="text-sm text-gray-400 ml-1">{plan.unit}</span>
                  </div>
                  <ul className="space-y-2 mb-5 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-xs text-gray-500">
                        <Check className={`h-3 w-3 shrink-0 ${isPopular ? 'text-emerald-500' : 'text-gray-300'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={`${appBase}/signup`}
                    className={`block w-full text-center rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                      isPopular
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {c.pricing.cta}
                  </a>
                </div>
              )
            })}
          </div>

          <p className="text-center mt-6 text-xs text-gray-400">
            {c.pricing.enterprise}{' '}
            <a href="mailto:hello@grantlume.com" className="font-semibold text-emerald-600 hover:underline">{c.pricing.enterpriseCta}</a>
          </p>
        </div>
      </section>

      {/* ══════════ TRUST STRIP ══════════ */}
      <section className="py-10 bg-gray-50/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-5">
            <Shield className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{c.trust.title}</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {c.trust.badges.map((badge, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-3.5 py-1.5 text-xs text-gray-500">
                <Check className="h-3 w-3 text-emerald-500" />
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section className="py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/60 px-8 py-12 sm:px-14 sm:py-14 text-center">
            <div className="absolute inset-0">
              <div className="absolute top-0 left-1/4 w-64 h-64 bg-emerald-100/50 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-100/50 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 max-w-md mx-auto">
                {c.cta.title}
              </h2>
              <div className="mt-7">
                <a
                  href={`${appBase}/signup`}
                  className="group inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20"
                >
                  {c.cta.button}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>
              <p className="mt-3 text-xs text-gray-400">{c.cta.note}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <GrantLumeLogo size={24} variant="color" />
                <span className="text-sm font-bold tracking-tight">
                  <span className="text-gray-700">Grant</span>
                  <span className="text-emerald-600">Lume</span>
                </span>
              </div>
              <span className="text-xs text-gray-400 hidden sm:inline">{c.footer.tagline}</span>
            </div>
            <div className="flex items-center gap-5 text-xs text-gray-400">
              <a href="#features" className="hover:text-gray-600 transition-colors">{c.nav.features}</a>
              <a href="#pricing" className="hover:text-gray-600 transition-colors">{c.nav.pricing}</a>
              <Link to="/terms" className="hover:text-gray-600 transition-colors">{c.footer.terms}</Link>
              <Link to="/privacy" className="hover:text-gray-600 transition-colors">{c.footer.privacy}</Link>
              <button onClick={() => setLang(lang === 'en' ? 'de' : 'en')} className="flex items-center gap-1 hover:text-gray-600 transition-colors">
                <Globe className="h-3 w-3" />{lang === 'en' ? 'DE' : 'EN'}
              </button>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <p className="text-[10px] text-gray-300">{c.footer.copy}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

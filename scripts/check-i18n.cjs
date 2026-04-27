#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * i18n sanity check.
 *
 * Walks src/ and src/locales/ to answer three questions:
 *
 *   1. Which translation keys exist in en.json but are MISSING in other
 *      locales? (the user sees the raw key string in those languages)
 *   2. Which keys are referenced by the code (`t('foo.bar')`) but DON'T
 *      exist in en.json? (the user always sees the raw key)
 *   3. Which keys exist in en.json but are NEVER used by the code?
 *      (dead translation entries — small but worth pruning over time)
 *
 * Run:  node scripts/check-i18n.cjs            (human report, exit 0/1)
 *       node scripts/check-i18n.cjs --json     (machine-readable JSON)
 *       node scripts/check-i18n.cjs --strict   (exit 1 if ANY gap, not just orphan keys)
 *
 * Wired into package.json as `npm run check:i18n`. Add `--strict` to CI
 * to gate merges; the default mode only fails on orphan keys (which are
 * always bugs) and reports translation gaps as warnings (which can be
 * filled iteratively).
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const LOCALES_DIR = path.join(ROOT, 'src', 'locales')
const SRC_DIR = path.join(ROOT, 'src')
const CANONICAL = 'en'

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2))
const asJson = args.has('--json')
const strict = args.has('--strict')

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch (err) {
    console.error(`Failed to read ${p}: ${err.message}`)
    process.exit(2)
  }
}

/** Recursively flatten { a: { b: 'x' } } → { 'a.b': 'x' } */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out)
    } else {
      out[key] = v
    }
  }
  return out
}

/** All .ts/.tsx files under src, excluding tests, locales, and types. */
function listSourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'locales' || entry.name === 'node_modules') continue
      listSourceFiles(full, acc)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue
    if (/\.d\.ts$/.test(entry.name)) continue
    acc.push(full)
  }
  return acc
}

/**
 * Extract translation keys referenced by the code. Matches:
 *   t('foo.bar')              — most common
 *   t("foo.bar")              — double-quoted
 *   t(`foo.bar`)              — backticks (only static, no ${})
 *   i18n.t('foo.bar')         — direct i18n usage
 *   t('foo.bar', { count })   — with options (we only care about the key)
 *
 * Skips dynamic keys (template strings with interpolation) — those can't
 * be statically verified. Reported separately so the dev knows they need
 * a runtime guard for those.
 */
function extractKeysFromSource(file) {
  const src = fs.readFileSync(file, 'utf-8')
  const keys = new Set()
  const dynamic = []

  // Static literal keys.
  const literalRe = /\bt\(\s*['"`]([^'"`$\n]+)['"`]/g
  let m
  while ((m = literalRe.exec(src)) !== null) {
    keys.add(m[1])
  }

  // Template literals with ${} → dynamic.
  const dynRe = /\bt\(\s*`([^`]*\$\{[^`]*)`/g
  while ((m = dynRe.exec(src)) !== null) {
    dynamic.push({ file, snippet: m[1].slice(0, 80) })
  }

  return { keys, dynamic }
}

// ──────────────────────────────────────────────────────────────────
// Run
// ──────────────────────────────────────────────────────────────────

const localeFiles = fs
  .readdirSync(LOCALES_DIR)
  .filter((f) => /\.json$/.test(f))
  .map((f) => ({ code: path.basename(f, '.json'), path: path.join(LOCALES_DIR, f) }))

const canonical = localeFiles.find((l) => l.code === CANONICAL)
if (!canonical) {
  console.error(`Canonical locale ${CANONICAL}.json not found in ${LOCALES_DIR}`)
  process.exit(2)
}

const flatLocales = {}
for (const loc of localeFiles) {
  flatLocales[loc.code] = flatten(readJson(loc.path))
}
const enKeys = new Set(Object.keys(flatLocales[CANONICAL]))

// Per-locale gap = keys in en.json but missing in this locale.
const missingPerLocale = {}
const orphansPerLocale = {} // keys in this locale but NOT in en.json

for (const loc of localeFiles) {
  if (loc.code === CANONICAL) continue
  const own = new Set(Object.keys(flatLocales[loc.code]))
  // For plural-suffixed keys, treat as a group: a key like `foo_one` is
  // missing only if both `foo_one` and `foo_other` (and friends) are
  // missing AND the unsuffixed `foo` doesn't exist either. Cleaner is
  // to compare unsuffixed key presence.
  missingPerLocale[loc.code] = [...enKeys]
    .filter((k) => !own.has(k))
    .sort()
  orphansPerLocale[loc.code] = [...own]
    .filter((k) => !enKeys.has(k))
    .sort()
}

// Walk source.
const srcFiles = listSourceFiles(SRC_DIR)
const codeKeys = new Set()
const codeKeyOrigins = new Map() // key → first file that uses it
const dynamicCallSites = []

for (const file of srcFiles) {
  const { keys, dynamic } = extractKeysFromSource(file)
  for (const k of keys) {
    codeKeys.add(k)
    if (!codeKeyOrigins.has(k)) codeKeyOrigins.set(k, file)
  }
  dynamicCallSites.push(...dynamic)
}

// Orphan keys = code references a key that doesn't exist in en.json.
// i18next resolves plurals via suffixed keys (e.g. `t('items', {count})`
// looks up `items_one` / `items_other`), so a code reference to `items`
// is satisfied as long as ANY plural variant exists in the locale.
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other']
function keyExistsInLocale(key, keySet) {
  if (keySet.has(key)) return true
  for (const suf of PLURAL_SUFFIXES) {
    if (keySet.has(key + suf)) return true
  }
  return false
}
const orphanKeysInCode = [...codeKeys]
  .filter((k) => !keyExistsInLocale(k, enKeys))
  .sort()

// Unused keys = en.json key never referenced by code. Some keys are
// referenced via dynamic `t(\`status.${val}\`)` — we conservatively
// keep any key whose prefix matches a dynamic-call common parent.
const dynamicPrefixes = new Set(
  dynamicCallSites
    .map((d) => d.snippet.match(/^([a-zA-Z0-9_.-]+)\./))
    .filter(Boolean)
    .map((m) => m[1]),
)
const unusedEnKeys = [...enKeys]
  .filter((k) => !codeKeys.has(k))
  .filter((k) => {
    // Heuristic: keep if any dynamic prefix is an ancestor of this key.
    for (const p of dynamicPrefixes) {
      if (k.startsWith(p + '.')) return false
    }
    return true
  })
  .sort()

// ──────────────────────────────────────────────────────────────────
// Output
// ──────────────────────────────────────────────────────────────────

if (asJson) {
  console.log(JSON.stringify({
    canonical: CANONICAL,
    locales: localeFiles.map((l) => ({
      code: l.code,
      keyCount: Object.keys(flatLocales[l.code]).length,
    })),
    enKeyCount: enKeys.size,
    codeKeyCount: codeKeys.size,
    orphanKeysInCode,
    missingPerLocale,
    orphansPerLocale,
    unusedEnKeys,
    dynamicCallSites: dynamicCallSites.slice(0, 50),
  }, null, 2))
  process.exit(orphanKeysInCode.length > 0 ? 1 : 0)
}

// Human report.
const C = process.stdout.isTTY ? {
  bold: '\x1b[1m', dim: '\x1b[2m', red: '\x1b[31m', yellow: '\x1b[33m',
  green: '\x1b[32m', cyan: '\x1b[36m', reset: '\x1b[0m',
} : { bold: '', dim: '', red: '', yellow: '', green: '', cyan: '', reset: '' }

console.log(`${C.bold}${C.cyan}== i18n sanity check ==${C.reset}`)
console.log(`canonical locale: ${CANONICAL}.json (${enKeys.size} leaf keys)`)
console.log(`source files scanned: ${srcFiles.length}`)
console.log(`unique t() keys in code: ${codeKeys.size}`)
console.log()

console.log(`${C.bold}Locale completeness${C.reset}`)
const COL = 12
console.log(`  ${'locale'.padEnd(COL)}${'keys'.padEnd(COL)}${'missing'.padEnd(COL)}${'orphans'}`)
for (const loc of localeFiles) {
  const count = Object.keys(flatLocales[loc.code]).length
  if (loc.code === CANONICAL) {
    console.log(`  ${C.dim}${loc.code.padEnd(COL)}${String(count).padEnd(COL)}${'-'.padEnd(COL)}-${C.reset}`)
    continue
  }
  const missing = missingPerLocale[loc.code].length
  const orphans = orphansPerLocale[loc.code].length
  const colour = missing === 0 ? C.green : missing > 50 ? C.red : C.yellow
  console.log(`  ${colour}${loc.code.padEnd(COL)}${String(count).padEnd(COL)}${String(missing).padEnd(COL)}${orphans}${C.reset}`)
}
console.log()

if (orphanKeysInCode.length > 0) {
  console.log(`${C.bold}${C.red}❌ Orphan keys (code → missing in en.json) — ${orphanKeysInCode.length}${C.reset}`)
  console.log(`${C.dim}These render as the raw key in EVERY locale. Fix in en.json.${C.reset}`)
  for (const k of orphanKeysInCode.slice(0, 20)) {
    const origin = codeKeyOrigins.get(k)
    const rel = origin ? path.relative(ROOT, origin) : ''
    console.log(`  ${C.red}•${C.reset} ${k}  ${C.dim}${rel}${C.reset}`)
  }
  if (orphanKeysInCode.length > 20) {
    console.log(`  ${C.dim}… and ${orphanKeysInCode.length - 20} more (use --json for the full list)${C.reset}`)
  }
  console.log()
}

const totalGaps = Object.values(missingPerLocale).reduce((a, b) => a + b.length, 0)
if (totalGaps > 0) {
  console.log(`${C.bold}${C.yellow}⚠ Translation gaps — ${totalGaps} total entries${C.reset}`)
  console.log(`${C.dim}These keys exist in en.json but are missing in the locale below — users see the raw key in that language.${C.reset}`)
  for (const loc of localeFiles) {
    if (loc.code === CANONICAL) continue
    const list = missingPerLocale[loc.code]
    if (list.length === 0) continue
    console.log(`  ${C.yellow}${loc.code}${C.reset}: ${list.length} missing`)
    for (const k of list.slice(0, 5)) {
      console.log(`    ${C.dim}•${C.reset} ${k}`)
    }
    if (list.length > 5) {
      console.log(`    ${C.dim}… and ${list.length - 5} more${C.reset}`)
    }
  }
  console.log()
}

const totalOrphans = Object.values(orphansPerLocale).reduce((a, b) => a + b.length, 0)
if (totalOrphans > 0) {
  console.log(`${C.bold}${C.dim}ℹ Stray locale keys (in locale but not in en.json) — ${totalOrphans}${C.reset}`)
  for (const loc of localeFiles) {
    if (loc.code === CANONICAL) continue
    const list = orphansPerLocale[loc.code]
    if (list.length === 0) continue
    console.log(`  ${loc.code}: ${list.length} stray`)
  }
  console.log()
}

if (unusedEnKeys.length > 0) {
  console.log(`${C.bold}${C.dim}ℹ Unused en.json keys (not referenced by t() in source) — ${unusedEnKeys.length}${C.reset}`)
  console.log(`  ${C.dim}May be false positives — keys used via dynamic t(\`x.\${y}\`) lookups can show up here. Skim before pruning.${C.reset}`)
}

if (dynamicCallSites.length > 0) {
  console.log(`${C.bold}${C.dim}ℹ Dynamic t() calls — ${dynamicCallSites.length}${C.reset}`)
  console.log(`  ${C.dim}These can't be statically verified. Make sure their key spaces have full coverage.${C.reset}`)
}

// Exit code.
const hasOrphans = orphanKeysInCode.length > 0
const hasGaps = totalGaps > 0
if (hasOrphans) {
  console.log(`\n${C.red}${C.bold}FAIL${C.reset}: orphan keys in code. Fix en.json before merging.`)
  process.exit(1)
}
if (strict && hasGaps) {
  console.log(`\n${C.red}${C.bold}FAIL${C.reset}: --strict mode and translation gaps present.`)
  process.exit(1)
}
console.log(`\n${C.green}${C.bold}OK${C.reset}: no orphan keys.`)
process.exit(0)

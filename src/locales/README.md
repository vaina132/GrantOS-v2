# Translations

This directory holds the JSON locale files that drive every user-facing
string in GrantLume. **`en.json` is the canonical source of truth.**
Every other locale is a translation of it.

## Files

| File      | Language   | Status |
|-----------|------------|--------|
| `en.json` | English    | canonical |
| `de.json` | Deutsch    | translated |
| `es.json` | Español    | translated |
| `fr.json` | Français   | translated |
| `pt.json` | Português  | translated |
| `tr.json` | Türkçe     | translated |

A locale that is missing a key automatically falls back to the English
value at runtime — users never see a raw key like `nav.dashboard`. The
fallback is good safety, but a half-translated screen is still poor UX,
so we keep coverage tight.

## Audit

Always-on tooling:

```bash
npm run check:i18n           # report on missing keys, orphans, dead keys
npm run check:i18n:strict    # exit 1 on any gap (suitable for CI)
```

The script:

- compares every non-`en` locale against `en.json` and reports missing keys
- finds **orphan keys** — `t('foo.bar')` calls in source where `foo.bar`
  doesn't exist in `en.json`. These render as the raw key in EVERY
  locale and are always bugs. The default mode fails the script if any
  exist.
- flags **stray keys** — entries in a locale that aren't in `en.json`.
  Usually a typo or a key that was renamed; safe to remove.
- flags **unused keys** — entries in `en.json` not referenced by any
  `t()` call. Some are false positives (used via `t(\`foo.${dynamic}\`)`
  patterns); skim before pruning.

Output is human-readable by default, or `--json` for machine consumption.

## Workflow

### Adding a new translatable string

1. Add the key + English copy to `en.json`. Use a sensible namespace
   (e.g. `proposals.documentEmpty`, not `randomThing.x`).
2. Use `t('your.new.key')` in the component.
3. Run `npm run check:i18n`. The script will list which locales are now
   behind. Add translations to each. The dev console will also warn
   ("[i18n] missing X in fr.json…") the first time the missing key is
   accessed in a non-en session — useful for catching anything you forgot.
4. Done. CI strict mode blocks merge if you forgot a locale.

### Adding a new language

1. Copy `en.json` to `<code>.json` in this folder (e.g. `it.json`).
2. Translate every value. Keep the keys identical to `en.json` — the
   audit script keys off structure.
3. Register the locale in `src/lib/i18n.ts`:
   - import the file
   - add it to `resources` and `supportedLngs`
   - add an entry to `SUPPORTED_LANGUAGES` (label + flag emoji)
4. Run `npm run check:i18n` to confirm zero missing keys.
5. Update the table at the top of this README.

### Pluralisation

Use i18next's plural suffixes directly in `en.json`:

```json
"agoMinutes_one": "{{count}} minute ago",
"agoMinutes_other": "{{count}} minutes ago"
```

Call as `t('agoMinutes', { count })` — i18next picks the right variant
based on the active locale's plural rules. The audit script knows about
plural suffixes, so a code reference to `agoMinutes` is satisfied as long
as `agoMinutes_one` (or any plural variant) exists.

## Common pitfalls

- **Don't** hardcode user-facing strings in JSX. Even one-word labels
  (`"Pending"`, `"Edit"`) belong in the locale files. The audit will
  miss them because there's no `t()` call to scan; the only defence is
  code review and the dev console warning.
- **Do** keep keys stable. Renaming a key is a churn event for every
  locale.
- **Do** include interpolation variables in your translation:
  `"deletedX": "Deleted {{name}}"` — translators need to know which
  placeholders to keep.

/**
 * EU funding programme IDs and labels as used by the SEDIA search index
 * (EC Funding & Tenders Portal). Shared between the client's Calls filter
 * dropdown and the server-side `/api/ai?action=eu-calls-list` handler that
 * translates a human-readable programme filter into one or more numeric IDs.
 *
 * IDs come from SEDIA's own facet data. Keep this list curated to the most
 * commonly searched programmes — the full upstream list has 60+ entries,
 * most of which are sunset or niche.
 */

export interface EuProgramme {
  id: string
  /** Display label shown in the dropdown */
  label: string
  /** Short code users commonly type (e.g. 'horizon', 'digital') */
  aliases?: string[]
  /** Set true for programmes that are closed / legacy — sorted to the end */
  legacy?: boolean
}

export const EU_PROGRAMMES: EuProgramme[] = [
  // Active 2021–2027 programmes, ordered by search popularity.
  { id: '43108390', label: 'Horizon Europe',                         aliases: ['horizon', 'he'] },
  { id: '43152860', label: 'Digital Europe',                         aliases: ['digital', 'dep'] },
  { id: '43353764', label: 'Erasmus+',                               aliases: ['erasmus', 'erasmus plus'] },
  { id: '43251814', label: 'Creative Europe',                        aliases: ['creative', 'crea'] },
  { id: '43252405', label: 'LIFE Programme',                         aliases: ['life'] },
  { id: '44181033', label: 'European Defence Fund',                  aliases: ['edf', 'defence'] },
  { id: '43251567', label: 'Connecting Europe Facility (CEF)',       aliases: ['cef'] },
  { id: '43332642', label: 'EU4Health',                              aliases: ['eu4health', 'health'] },
  { id: '43089234', label: 'Innovation Fund',                        aliases: ['innovation fund', 'innovfund'] },
  { id: '43298916', label: 'Euratom Research and Training',          aliases: ['euratom'] },
  { id: '43252476', label: 'Single Market Programme',                aliases: ['smp'] },
  { id: '43251589', label: 'Citizens, Equality, Rights and Values',  aliases: ['cerv'] },
  { id: '43252386', label: 'Justice Programme',                      aliases: ['just', 'justice'] },
  { id: '43254019', label: 'European Social Fund Plus (ESF+)',       aliases: ['esf', 'esf+'] },
  { id: '43392145', label: 'EMFAF (Maritime, Fisheries & Aquaculture)', aliases: ['emfaf'] },
  { id: '43254037', label: 'European Solidarity Corps',              aliases: ['esc', 'solidarity'] },
  { id: '43253706', label: 'Technical Support Instrument (TSI)',     aliases: ['tsi'] },
  { id: '44416173', label: 'Interregional Innovation Investments (I3)', aliases: ['i3'] },
  { id: '44773066', label: 'Just Transition Mechanism',              aliases: ['jtm', 'just transition'] },
  { id: '43251530', label: 'Border Management and Visa Policy (BMVI)', aliases: ['bmvi'] },
  { id: '43252368', label: 'Internal Security Fund (ISF)',           aliases: ['isf'] },
  { id: '43251447', label: 'Asylum, Migration and Integration Fund (AMIF)', aliases: ['amif'] },
  { id: '43253979', label: 'Customs Programme',                      aliases: ['customs', 'cust'] },
  { id: '43253995', label: 'Fiscalis Programme',                     aliases: ['fiscalis', 'fisc'] },
  { id: '43298203', label: 'Union Civil Protection Mechanism',       aliases: ['ucpm'] },
  { id: '43298664', label: 'Promotion of Agricultural Products',     aliases: ['agrip'] },
  { id: '43251842', label: 'Union Anti-Fraud Programme',             aliases: ['euaf'] },

  // Legacy / closed programmes kept for reference when browsing archived calls.
  { id: '31045243', label: 'Horizon 2020 (legacy 2014–2020)',        aliases: ['h2020'], legacy: true },
  { id: '31059643', label: 'COSME (legacy 2014–2020)',               aliases: ['cosme'], legacy: true },
  { id: '31076817', label: 'Rights, Equality and Citizenship (REC, legacy)', aliases: ['rec'], legacy: true },
  { id: '31059093', label: 'Erasmus+ (legacy 2014–2020)',            legacy: true },
  { id: '31107710', label: 'LIFE (legacy 2014–2020)',                legacy: true },
]

/** Fast lookup: programme ID → label. */
export const EU_PROGRAMME_LABELS: Record<string, string> = Object.fromEntries(
  EU_PROGRAMMES.map(p => [p.id, p.label]),
)

/**
 * Resolve a user-typed programme token to zero or more SEDIA IDs.
 * Matching is case-insensitive, checks the label and any aliases, and
 * accepts a raw numeric ID too.
 */
export function resolveProgrammeIds(input: string): string[] {
  const q = input.trim().toLowerCase()
  if (!q) return []
  if (/^\d+$/.test(q)) return [q]
  const hits: string[] = []
  for (const p of EU_PROGRAMMES) {
    if (p.label.toLowerCase().includes(q)) {
      hits.push(p.id)
      continue
    }
    if (p.aliases?.some(a => a.toLowerCase() === q || a.toLowerCase().includes(q))) {
      hits.push(p.id)
    }
  }
  return hits
}

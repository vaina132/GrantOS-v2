// ============================================================================
// EU Funding Programmes (Horizon Europe and predecessors + national)
// ============================================================================

export const FUNDING_PROGRAMMES = [
  'Horizon Europe',
  'Horizon 2020',
  'FP7',
  'ERC',
  'MSCA (Marie Skłodowska-Curie Actions)',
  'EIC (European Innovation Council)',
  'Digital Europe Programme',
  'Erasmus+',
  'LIFE Programme',
  'Creative Europe',
  'EU4Health',
  'Connecting Europe Facility (CEF)',
  'Interreg',
  'COST Actions',
  'Eurostars',
  'Clean Hydrogen JU',
  'KDT JU (Key Digital Technologies)',
  'Innovative Health Initiative (IHI)',
  'Circular Bio-based Europe (CBE JU)',
  'Single European Sky ATM Research (SESAR 3 JU)',
  'Europe\'s Rail JU',
  'Clean Aviation JU',
  'EIT (European Institute of Innovation & Technology)',
  'European Defence Fund (EDF)',
  'DFG (German Research Foundation)',
  'ANR (Agence Nationale de la Recherche)',
  'UKRI',
  'NWO (Netherlands)',
  'FWF (Austrian Science Fund)',
  'SNF (Swiss National Science Foundation)',
]

// ============================================================================
// Funding Schemes (actions/instruments) — hierarchically grouped by programme
// ============================================================================

export const FUNDING_SCHEMES: Record<string, string[]> = {
  'Horizon Europe': [
    'Research and Innovation Action (RIA)',
    'Innovation Action (IA)',
    'Coordination and Support Action (CSA)',
    'ERC Starting Grant',
    'ERC Consolidator Grant',
    'ERC Advanced Grant',
    'ERC Synergy Grant',
    'ERC Proof of Concept',
    'MSCA Doctoral Networks',
    'MSCA Postdoctoral Fellowships',
    'MSCA Staff Exchanges',
    'MSCA COFUND',
    'MSCA Citizens',
    'EIC Pathfinder',
    'EIC Transition',
    'EIC Accelerator',
    'Lump Sum Grant',
    'Framework Partnership Agreement',
    'Programme Co-fund Action',
    'Pre-commercial Procurement (PCP)',
    'Public Procurement of Innovation (PPI)',
  ],
  'Horizon 2020': [
    'Research and Innovation Action (RIA)',
    'Innovation Action (IA)',
    'Coordination and Support Action (CSA)',
    'SME Instrument Phase 1',
    'SME Instrument Phase 2',
    'Fast Track to Innovation (FTI)',
    'ERA-NET Cofund',
  ],
  'FP7': [
    'Collaborative Project (CP)',
    'Network of Excellence (NoE)',
    'Coordination Action (CA)',
    'Support Action (SA)',
    'Research for SMEs',
  ],
  'Erasmus+': [
    'KA1 — Learning Mobility',
    'KA2 — Cooperation Partnerships',
    'KA3 — Policy Reform',
    'Jean Monnet Actions',
    'Erasmus Mundus Joint Masters',
  ],
  'Digital Europe Programme': [
    'Simple Grant',
    'SME Support Action',
  ],
  'LIFE Programme': [
    'Standard Action Projects (SAP)',
    'Strategic Integrated Projects (SIP)',
    'Technical Assistance Projects',
    'Operating Grants',
  ],
  'Other': [
    'Grant Agreement',
    'Service Contract',
    'Framework Contract',
    'Prize',
    'Procurement',
  ],
}

export const ALL_FUNDING_SCHEMES = Object.values(FUNDING_SCHEMES).flat()

// ============================================================================
// Horizon Europe Country Codes (EU Member States + Associated Countries)
// ============================================================================

export const HORIZON_COUNTRIES: { code: string; name: string }[] = [
  // EU Member States
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  // Horizon Europe Associated Countries
  { code: 'AL', name: 'Albania' },
  { code: 'AM', name: 'Armenia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'FO', name: 'Faroe Islands' },
  { code: 'GE', name: 'Georgia' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IL', name: 'Israel' },
  { code: 'XK', name: 'Kosovo' },
  { code: 'MD', name: 'Moldova' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'RS', name: 'Serbia' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Türkiye' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'KR', name: 'South Korea' },
  { code: 'JP', name: 'Japan' },
  { code: 'CA', name: 'Canada' },
  // Other commonly seen
  { code: 'CH', name: 'Switzerland' },
  { code: 'US', name: 'United States' },
  { code: 'AU', name: 'Australia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
]

// ============================================================================
// Organisation Types (official EU PIC classification)
// Based on Horizon Europe Participant Identification Code (PIC) types
// ============================================================================

export const ORG_TYPES: { code: string; label: string; description: string }[] = [
  { code: 'HES', label: 'Higher Education', description: 'Universities, colleges, and other higher education institutions' },
  { code: 'REC', label: 'Research Organisation', description: 'Public or private non-profit entities whose primary mission is research' },
  { code: 'PRC', label: 'Private Company', description: 'Private for-profit enterprises including SMEs and large companies' },
  { code: 'PUB', label: 'Public Body', description: 'National, regional, or local government bodies and other public entities' },
  { code: 'OTH', label: 'Other', description: 'International organisations, NGOs, associations, foundations, etc.' },
]

// ============================================================================
// Budget Tooltips — explain each budget category to the user
// ============================================================================

export const BUDGET_TOOLTIPS: Record<string, string> = {
  budget_personnel: 'Direct personnel costs: Salaries, social charges, and other statutory costs for staff working on the project. This is usually the largest cost category.',
  budget_subcontracting: 'Costs of work carried out by third parties under a subcontract. Subcontracting must be identified in the Grant Agreement.',
  budget_travel: 'Travel & Subsistence: Costs for flights, accommodation, meals, and other travel expenses related to project activities (meetings, conferences, fieldwork).',
  budget_equipment: 'Costs of equipment purchased or rented specifically for the project. Only the depreciation portion allocable to the project is eligible.',
  budget_other_goods: 'Other Goods, Works & Services: Any other direct costs not covered above — materials, consumables, publications, IP costs, audit certificates, etc.',
  total_person_months: 'Total person-months (PMs) allocated to this partner. One PM = one person working full-time for one month. E.g., 24 PM = 2 person-years.',
  funding_rate: 'EC funding rate as a percentage of eligible costs. For RIA this is typically 100%, for IA it\'s usually 70% (100% for non-profit).',
  indirect_cost_rate: 'Flat rate for indirect costs (overhead), applied on top of direct costs. Standard Horizon Europe rate is 25%.',
  indirect_cost_base: 'Which direct costs the indirect rate applies to. Standard: all direct costs minus subcontracting. Some programmes use different bases.',
}

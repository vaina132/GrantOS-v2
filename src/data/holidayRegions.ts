/**
 * Regional subdivision codes used by the Nager.Date public holiday API.
 * Keys are ISO 3166-1 alpha-2 country codes.
 * Values map ISO 3166-2 subdivision codes to their English names.
 *
 * Only countries whose Nager.Date API data contains non-global (regional) holidays
 * are listed here. Countries where all holidays are global (e.g. AT, FR, HR) are
 * intentionally omitted — they have no region selector.
 *
 * Sources: ISO 3166-2, Nager.Date API /api/v3/PublicHolidays/{year}/{country}
 */

export const HOLIDAY_REGIONS: Record<string, Record<string, string>> = {
  // ── Germany (Bundesländer) ────────────────────────────────────────────
  DE: {
    'DE-BW': 'Baden-Württemberg',
    'DE-BY': 'Bavaria (Bayern)',
    'DE-BE': 'Berlin',
    'DE-BB': 'Brandenburg',
    'DE-HB': 'Bremen',
    'DE-HH': 'Hamburg',
    'DE-HE': 'Hesse (Hessen)',
    'DE-MV': 'Mecklenburg-Vorpommern',
    'DE-NI': 'Lower Saxony (Niedersachsen)',
    'DE-NW': 'North Rhine-Westphalia (NRW)',
    'DE-RP': 'Rhineland-Palatinate (Rheinland-Pfalz)',
    'DE-SL': 'Saarland',
    'DE-SN': 'Saxony (Sachsen)',
    'DE-ST': 'Saxony-Anhalt (Sachsen-Anhalt)',
    'DE-SH': 'Schleswig-Holstein',
    'DE-TH': 'Thuringia (Thüringen)',
  },

  // ── Spain (Comunidades Autónomas) ─────────────────────────────────────
  ES: {
    'ES-AN': 'Andalusia (Andalucía)',
    'ES-AR': 'Aragon (Aragón)',
    'ES-AS': 'Asturias',
    'ES-CB': 'Cantabria',
    'ES-CL': 'Castile and León (Castilla y León)',
    'ES-CM': 'Castilla-La Mancha',
    'ES-CN': 'Canary Islands (Canarias)',
    'ES-CT': 'Catalonia (Catalunya)',
    'ES-EX': 'Extremadura',
    'ES-GA': 'Galicia',
    'ES-IB': 'Balearic Islands (Illes Balears)',
    'ES-RI': 'La Rioja',
    'ES-MD': 'Madrid',
    'ES-MC': 'Murcia',
    'ES-NC': 'Navarre (Navarra)',
    'ES-PV': 'Basque Country (País Vasco)',
    'ES-VC': 'Valencian Community (Comunitat Valenciana)',
  },

  // ── Switzerland (Kantone / Cantons) ───────────────────────────────────
  CH: {
    'CH-AG': 'Aargau',
    'CH-AI': 'Appenzell Innerrhoden',
    'CH-AR': 'Appenzell Ausserrhoden',
    'CH-BE': 'Bern',
    'CH-BL': 'Basel-Landschaft',
    'CH-BS': 'Basel-Stadt',
    'CH-FR': 'Fribourg',
    'CH-GE': 'Geneva (Genève)',
    'CH-GL': 'Glarus',
    'CH-GR': 'Graubünden',
    'CH-JU': 'Jura',
    'CH-LU': 'Lucerne (Luzern)',
    'CH-NE': 'Neuchâtel',
    'CH-NW': 'Nidwalden',
    'CH-OW': 'Obwalden',
    'CH-SG': 'St. Gallen',
    'CH-SH': 'Schaffhausen',
    'CH-SO': 'Solothurn',
    'CH-SZ': 'Schwyz',
    'CH-TG': 'Thurgau',
    'CH-TI': 'Ticino',
    'CH-UR': 'Uri',
    'CH-VD': 'Vaud',
    'CH-VS': 'Valais',
    'CH-ZG': 'Zug',
    'CH-ZH': 'Zürich',
  },

  // ── United Kingdom (Constituent countries) ────────────────────────────
  GB: {
    'GB-ENG': 'England',
    'GB-NIR': 'Northern Ireland',
    'GB-SCT': 'Scotland',
    'GB-WLS': 'Wales',
  },

  // ── Italy (Regioni) ───────────────────────────────────────────────────
  IT: {
    'IT-32': 'Trentino-Alto Adige / Südtirol',
  },

  // ── Portugal (Regiões autónomas) ──────────────────────────────────────
  PT: {
    'PT-20': 'Azores (Açores)',
    'PT-30': 'Madeira',
  },
}

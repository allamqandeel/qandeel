/**
 * S6-01 — the display names of the broad-area preparation catalogue (S6-01 record §4.4; migration 0154). A preparation
 * catalogue, NOT launch policy: which countries real Matching serves is a later Product decision.
 *
 * The codes are ISO 3166-1 alpha-2 (countries) and ISO 3166-2 (first-level regions). The database holds the codes and
 * is the authority; this file holds only the names, and a test proves the two code sets are identical. Place names are
 * proper nouns in their usual Modern Standard Arabic form.
 */
type Name = readonly [ar: string, en: string];

export const AREA_COUNTRIES: Readonly<Record<string, Name>> = Object.freeze({
  AE: ['الإمارات العربية المتحدة', 'United Arab Emirates'],
  BH: ['البحرين', 'Bahrain'],
  DJ: ['جيبوتي', 'Djibouti'],
  DZ: ['الجزائر', 'Algeria'],
  EG: ['مصر', 'Egypt'],
  IQ: ['العراق', 'Iraq'],
  JO: ['الأردن', 'Jordan'],
  KM: ['جزر القمر', 'Comoros'],
  KW: ['الكويت', 'Kuwait'],
  LB: ['لبنان', 'Lebanon'],
  LY: ['ليبيا', 'Libya'],
  MA: ['المغرب', 'Morocco'],
  MR: ['موريتانيا', 'Mauritania'],
  OM: ['عُمان', 'Oman'],
  PS: ['فلسطين', 'Palestine'],
  QA: ['قطر', 'Qatar'],
  SA: ['المملكة العربية السعودية', 'Saudi Arabia'],
  SD: ['السودان', 'Sudan'],
  SO: ['الصومال', 'Somalia'],
  SY: ['سوريا', 'Syria'],
  TN: ['تونس', 'Tunisia'],
  YE: ['اليمن', 'Yemen'],
});

export const AREA_REGIONS: Readonly<Record<string, Name>> = Object.freeze({
  // Egypt — 27 governorates
  'EG-ALX': ['الإسكندرية', 'Alexandria'], 'EG-ASN': ['أسوان', 'Aswan'], 'EG-AST': ['أسيوط', 'Asyut'],
  'EG-BA': ['البحر الأحمر', 'Red Sea'], 'EG-BH': ['البحيرة', 'Beheira'], 'EG-BNS': ['بني سويف', 'Beni Suef'],
  'EG-C': ['القاهرة', 'Cairo'], 'EG-DK': ['الدقهلية', 'Dakahlia'], 'EG-DT': ['دمياط', 'Damietta'],
  'EG-FYM': ['الفيوم', 'Faiyum'], 'EG-GH': ['الغربية', 'Gharbia'], 'EG-GZ': ['الجيزة', 'Giza'],
  'EG-IS': ['الإسماعيلية', 'Ismailia'], 'EG-JS': ['جنوب سيناء', 'South Sinai'], 'EG-KB': ['القليوبية', 'Qalyubia'],
  'EG-KFS': ['كفر الشيخ', 'Kafr El Sheikh'], 'EG-KN': ['قنا', 'Qena'], 'EG-LX': ['الأقصر', 'Luxor'],
  'EG-MN': ['المنيا', 'Minya'], 'EG-MNF': ['المنوفية', 'Monufia'], 'EG-MT': ['مطروح', 'Matrouh'],
  'EG-PTS': ['بورسعيد', 'Port Said'], 'EG-SHG': ['سوهاج', 'Sohag'], 'EG-SHR': ['الشرقية', 'Sharqia'],
  'EG-SIN': ['شمال سيناء', 'North Sinai'], 'EG-SUZ': ['السويس', 'Suez'], 'EG-WAD': ['الوادي الجديد', 'New Valley'],
  // Saudi Arabia — 13 regions
  'SA-01': ['الرياض', 'Riyadh'], 'SA-02': ['مكة المكرمة', 'Makkah'], 'SA-03': ['المدينة المنورة', 'Madinah'],
  'SA-04': ['المنطقة الشرقية', 'Eastern Province'], 'SA-05': ['القصيم', 'Al-Qassim'], 'SA-06': ['حائل', "Ha'il"],
  'SA-07': ['تبوك', 'Tabuk'], 'SA-08': ['الحدود الشمالية', 'Northern Borders'], 'SA-09': ['جازان', 'Jazan'],
  'SA-10': ['نجران', 'Najran'], 'SA-11': ['الباحة', 'Al-Bahah'], 'SA-12': ['الجوف', 'Al-Jawf'], 'SA-14': ['عسير', 'Asir'],
  // United Arab Emirates — 7 emirates
  'AE-AJ': ['عجمان', 'Ajman'], 'AE-AZ': ['أبوظبي', 'Abu Dhabi'], 'AE-DU': ['دبي', 'Dubai'], 'AE-FU': ['الفجيرة', 'Fujairah'],
  'AE-RK': ['رأس الخيمة', 'Ras Al Khaimah'], 'AE-SH': ['الشارقة', 'Sharjah'], 'AE-UQ': ['أم القيوين', 'Umm Al Quwain'],
  // Kuwait — 6 governorates
  'KW-AH': ['الأحمدي', 'Al Ahmadi'], 'KW-FA': ['الفروانية', 'Al Farwaniyah'], 'KW-HA': ['حولي', 'Hawalli'],
  'KW-JA': ['الجهراء', 'Al Jahra'], 'KW-KU': ['العاصمة', 'Capital'], 'KW-MU': ['مبارك الكبير', 'Mubarak Al-Kabeer'],
  // Qatar — 8 municipalities
  'QA-DA': ['الدوحة', 'Doha'], 'QA-KH': ['الخور والذخيرة', 'Al Khor and Al Thakhira'], 'QA-MS': ['الشمال', 'Al Shamal'],
  'QA-RA': ['الريان', 'Al Rayyan'], 'QA-SH': ['الشحانية', 'Al Shahaniya'], 'QA-US': ['أم صلال', 'Umm Salal'],
  'QA-WA': ['الوكرة', 'Al Wakrah'], 'QA-ZA': ['الضعاين', 'Al Daayen'],
  // Bahrain — 4 governorates
  'BH-13': ['العاصمة', 'Capital'], 'BH-14': ['الجنوبية', 'Southern'], 'BH-15': ['المحرق', 'Muharraq'], 'BH-17': ['الشمالية', 'Northern'],
  // Oman — 11 governorates
  'OM-BJ': ['جنوب الباطنة', 'South Al Batinah'], 'OM-BS': ['شمال الباطنة', 'North Al Batinah'], 'OM-BU': ['البريمي', 'Al Buraimi'],
  'OM-DA': ['الداخلية', 'Ad Dakhiliyah'], 'OM-MA': ['مسقط', 'Muscat'], 'OM-MU': ['مسندم', 'Musandam'],
  'OM-SJ': ['جنوب الشرقية', 'South Ash Sharqiyah'], 'OM-SS': ['شمال الشرقية', 'North Ash Sharqiyah'], 'OM-WU': ['الوسطى', 'Al Wusta'],
  'OM-ZA': ['الظاهرة', 'Ad Dhahirah'], 'OM-ZU': ['ظفار', 'Dhofar'],
  // Jordan — 12 governorates
  'JO-AJ': ['عجلون', 'Ajloun'], 'JO-AM': ['العاصمة', 'Amman'], 'JO-AQ': ['العقبة', 'Aqaba'], 'JO-AT': ['الطفيلة', 'Tafilah'],
  'JO-AZ': ['الزرقاء', 'Zarqa'], 'JO-BA': ['البلقاء', 'Balqa'], 'JO-IR': ['إربد', 'Irbid'], 'JO-JA': ['جرش', 'Jerash'],
  'JO-KA': ['الكرك', 'Karak'], 'JO-MA': ['المفرق', 'Mafraq'], 'JO-MD': ['مأدبا', 'Madaba'], 'JO-MN': ['معان', "Ma'an"],
});

/** The listed first-level regions of one country, in catalogue order; empty when the country has none listed. */
export function regionsOf(countryCode: string): readonly string[] {
  return Object.keys(AREA_REGIONS).filter((code) => code.startsWith(`${countryCode}-`));
}

export function areaName(code: string, language: 'ar' | 'en'): string {
  const name = AREA_COUNTRIES[code] ?? AREA_REGIONS[code];
  return name === undefined ? code : name[language === 'ar' ? 0 : 1];
}

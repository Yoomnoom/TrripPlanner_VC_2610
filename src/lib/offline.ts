/** Language to request local names in, per destination country (Places API `languageCode`). */
const LANG: Record<string, string> = {
  JP: 'ja',
  KR: 'ko',
  CN: 'zh-CN',
  TW: 'zh-TW',
  HK: 'zh-HK',
  TH: 'th',
  VN: 'vi',
  ID: 'id',
  MY: 'ms',
  PH: 'en',
  SG: 'en',
  FR: 'fr',
  DE: 'de',
  IT: 'it',
  ES: 'es',
  PT: 'pt',
  NL: 'nl',
  CZ: 'cs',
  AT: 'de',
  CH: 'de',
  TR: 'tr',
  MX: 'es',
  EG: 'ar',
  AE: 'ar',
  US: 'en',
  CA: 'en',
  GB: 'en',
  AU: 'en',
  NZ: 'en',
};

export const languageFor = (countryCode: string | null | undefined) =>
  countryCode ? (LANG[countryCode.toUpperCase()] ?? null) : null;

/** What is kept on the device for one place (never sent to our database). */
export interface OfflineCard {
  id: string;
  tripId: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  localName: string | null;
  localAddress: string | null;
  savedAt: string;
}

export function buildCard(
  p: { id: string; name: string; address: string | null; lat: number | null; lng: number | null },
  tripId: string,
  now: Date = new Date(),
): OfflineCard {
  return {
    id: p.id,
    tripId,
    name: p.name,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    localName: null,
    localAddress: null,
    savedAt: now.toISOString(),
  };
}

/** Folds a Places API (New) details answer (`displayName.text`, `formattedAddress`) into a card; bad shapes change nothing. */
export function mergeLocal(card: OfflineCard, details: unknown): OfflineCard {
  const d = details as { displayName?: { text?: unknown }; formattedAddress?: unknown } | null;
  const name = typeof d?.displayName?.text === 'string' ? d.displayName.text : null;
  const addr = typeof d?.formattedAddress === 'string' ? d.formattedAddress : null;
  if (!name && !addr) return card;
  return { ...card, localName: name ?? card.localName, localAddress: addr ?? card.localAddress };
}

/** Text for the driver card: stored local-language values win, then the stored name/address. */
export function nameForDriver(
  card: OfflineCard | undefined,
  place: { name: string; address: string | null },
): { name: string; localName: string | null; address: string | null } {
  return {
    name: place.name,
    localName: card?.localName ?? null,
    address: card?.localAddress ?? place.address,
  };
}

/** Places API (New) details URL for one place in a language (browser key). UNVERIFIED without a key. */
export const placeDetailsUrl = (googlePlaceId: string, lang: string) =>
  `https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}?languageCode=${encodeURIComponent(lang)}`;

export const PLACE_DETAILS_FIELD_MASK = 'displayName,formattedAddress';

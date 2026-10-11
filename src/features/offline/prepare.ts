import { googleEnv, googleEnabled } from '@/lib/env';
import {
  buildCard,
  languageFor,
  mergeLocal,
  PLACE_DETAILS_FIELD_MASK,
  placeDetailsUrl,
  type OfflineCard,
} from '@/lib/offline';
import { loadCards, saveCards } from '@/lib/offlineStore';
import { createQueue } from '@/lib/queue';

export interface CardSource {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  google_place_id: string | null;
}

/**
 * "오프라인용으로 저장": keeps each scheduled place (name, address, coordinates) on this device. With a browser key
 * the local-language name/address is fetched too (Places API New, 3 at a time); that call is UNVERIFIED here
 * (docs/HUMAN_TODO.md). Nothing is sent to our database, and Google map tiles are never cached (terms of use).
 */
export async function prepareOfflineCards(
  tripId: string,
  places: readonly CardSource[],
  countryCode: string | null,
): Promise<{ saved: number; local: number; usedKey: boolean }> {
  const lang = languageFor(countryCode);
  const useKey = googleEnabled && lang !== null;
  const run = createQueue(3);

  const cards = await Promise.all(
    places.map((p) =>
      run(async (): Promise<OfflineCard> => {
        const card = buildCard(p, tripId);
        if (!useKey || !p.google_place_id || p.google_place_id.startsWith('fake:')) return card;
        try {
          const res = await fetch(placeDetailsUrl(p.google_place_id, lang!), {
            headers: {
              'X-Goog-Api-Key': googleEnv.browserKey!,
              'X-Goog-FieldMask': PLACE_DETAILS_FIELD_MASK,
            },
          });
          return res.ok ? mergeLocal(card, await res.json()) : card;
        } catch {
          return card; // keep the stored name/address when the lookup fails
        }
      }),
    ),
  );
  await saveCards(tripId, cards);
  return { saved: cards.length, local: cards.filter((c) => c.localName).length, usedKey: useKey };
}

export { loadCards };

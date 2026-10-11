import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';

/**
 * "기사님께 보여주기": the place name and address in very large text for a taxi driver. Local-language names need
 * the Places API (offline cards, M17); until then the stored name/address are shown as they are.
 */
export function DriverCard({
  place,
  onClose,
}: {
  place: { name: string; localName?: string | null; address: string | null } | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!place} onClose={onClose} title={copy.driver.title}>
      {place && (
        <div className="grid gap-4 py-2 text-center">
          <p className="text-sm text-muted">{copy.driver.hint}</p>
          <p
            lang={place.localName ? undefined : 'ko'}
            className="break-keep text-4xl font-extrabold leading-tight"
          >
            {place.localName ?? place.name}
          </p>
          {place.localName && place.localName !== place.name && (
            <p className="text-lg text-muted">{place.name}</p>
          )}
          {place.address && <p className="break-keep text-2xl font-semibold leading-snug">{place.address}</p>}
          {!place.localName && <p className="text-xs text-muted">{copy.driver.noLocal}</p>}
        </div>
      )}
    </Sheet>
  );
}

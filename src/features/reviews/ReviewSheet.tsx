import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn, inputCls } from '@/components/styles';
import { Avatar } from '@/components/ui-kit';
import type { Member } from '@/features/trips/api';
import { stars } from '@/lib/reviews';
import { useOnline } from '@/lib/offlineStore';
import { MAX_PHOTOS, useDeletePhoto, usePhotoUrl, useUploadPhoto, type PlacePhoto, type Review } from './api';

/** Rate and comment on a place, add up to 5 photos, and read the other members' reviews. */
export function ReviewSheet({
  place,
  tripId,
  meMemberId,
  members,
  reviews,
  photos,
  onClose,
  onSave,
  onDelete,
}: {
  place: { id: string; name: string } | null;
  tripId: string;
  meMemberId: string | null;
  members: Member[];
  reviews: Review[];
  photos: PlacePhoto[];
  onClose: () => void;
  onSave: (r: { placeId: string; rating: number; comment: string | null }) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Sheet open={!!place} onClose={onClose} title={place ? `${place.name} ${copy.reviews.title}` : ''}>
      {place && (
        <Body
          key={place.id}
          place={place}
          tripId={tripId}
          meMemberId={meMemberId}
          members={members}
          reviews={reviews.filter((r) => r.place_id === place.id)}
          photos={photos.filter((p) => p.place_id === place.id)}
          onSave={onSave}
          onDelete={onDelete}
          onClose={onClose}
        />
      )}
    </Sheet>
  );
}

function Body({
  place,
  tripId,
  meMemberId,
  members,
  reviews,
  photos,
  onSave,
  onDelete,
  onClose,
}: {
  place: { id: string; name: string };
  tripId: string;
  meMemberId: string | null;
  members: Member[];
  reviews: Review[];
  photos: PlacePhoto[];
  onSave: (r: { placeId: string; rating: number; comment: string | null }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const mine = reviews.find((r) => r.member_id === meMemberId);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [comment, setComment] = useState(mine?.comment ?? '');
  const online = useOnline();
  const upload = useUploadPhoto(tripId);
  const file = useRef<HTMLInputElement>(null);
  const del = useDeletePhoto(tripId);
  const myPhotos = photos; // photos belong to the place; any member may add (max 5 per place)
  const others = reviews.filter((r) => r.member_id !== meMemberId);

  return (
    <div className="grid gap-4">
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (rating >= 1) {
            onSave({ placeId: place.id, rating, comment: comment.trim() || null });
            onClose();
          }
        }}
      >
        <div role="radiogroup" aria-label={copy.reviews.rating} className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={copy.reviews.stars(n)}
              onClick={() => setRating(n)}
              className={`grid size-11 place-items-center rounded-full text-2xl ${n <= rating ? 'text-amber-500' : 'text-line'}`}
            >
              ★
            </button>
          ))}
          <span className="tabular ml-2 self-center text-sm font-semibold">
            {rating > 0 ? `${rating}/5` : ''}
          </span>
        </div>
        <input
          className={inputCls}
          value={comment}
          maxLength={300}
          placeholder={copy.reviews.commentPlaceholder}
          aria-label={copy.reviews.comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="flex gap-2">
          <button type="submit" className={`${btn.primary} flex-1`} disabled={rating < 1}>
            {copy.common.save}
          </button>
          {mine && (
            <button
              type="button"
              className={btn.ghost}
              onClick={() => {
                onDelete(mine.id);
                onClose();
              }}
            >
              {copy.reviews.remove}
            </button>
          )}
        </div>
      </form>

      <section aria-label={copy.reviews.photos}>
        <h3 className="text-sm font-bold">
          {copy.reviews.photos}{' '}
          <span className="font-normal text-muted">
            {myPhotos.length}/{MAX_PHOTOS}
          </span>
        </h3>
        <div className="mt-1 flex flex-wrap gap-2">
          {myPhotos.map((p) => (
            <Thumb key={p.id} photo={p} onRemove={() => del.mutate(p)} />
          ))}
          {myPhotos.length < MAX_PHOTOS && (
            <>
              <button
                type="button"
                aria-label={copy.reviews.addPhoto}
                className="grid size-20 place-items-center rounded-input border border-dashed border-line text-muted disabled:opacity-50"
                disabled={upload.isPending || !online}
                onClick={() => file.current?.click()}
              >
                <Camera className="size-6" aria-hidden />
              </button>
              <input
                ref={file}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) upload.mutate({ placeId: place.id, file: f });
                }}
              />
            </>
          )}
        </div>
      </section>

      {others.length > 0 && (
        <section aria-label={copy.reviews.others}>
          <h3 className="text-sm font-bold">{copy.reviews.others}</h3>
          <ul className="mt-1 grid gap-2">
            {others.map((r) => {
              const m = members.find((x) => x.id === r.member_id);
              return (
                <li key={r.id} className="flex items-start gap-2">
                  {m && <Avatar nickname={m.nickname} color={m.color} className="size-8 text-xs" />}
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">
                      {m?.nickname}{' '}
                      <span className="text-amber-500" aria-hidden>
                        {stars(r.rating)}
                      </span>
                      <span className="tabular ml-1 text-xs text-muted">{r.rating}/5</span>
                    </p>
                    {r.comment && <p className="text-muted">{r.comment}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function Thumb({ photo, onRemove }: { photo: PlacePhoto; onRemove: () => void }) {
  const url = usePhotoUrl(photo.storage_path);
  return (
    <div className="relative size-20 overflow-hidden rounded-input bg-bg">
      {url.data && <img src={url.data} alt={copy.reviews.photoAlt} className="size-full object-cover" />}
      <button
        type="button"
        aria-label={copy.reviews.removePhoto}
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 grid size-7 place-items-center rounded-full bg-black/60 text-white"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

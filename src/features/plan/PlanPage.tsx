import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  Footprints,
  GripVertical,
  MoreVertical,
  Plus,
  StickyNote,
  TramFront,
  Car,
} from 'lucide-react';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { scheduleToCsv } from '@/lib/calendar';
import { downloadCsv } from '@/lib/csv';
import { googleEnabled } from '@/lib/env';
import { Skeleton, ErrorState } from '@/components/ui-kit';
import { btn } from '@/components/styles';
import { dayFirstStart, groupByDay, hm, insertAt, legLabel, nextMode, nextSlot, reflowDay } from '@/lib/plan';
import { dayYmd, formatMdWeekday, todayYmd, tripDays } from '@/lib/trip';
import { LABELS_KO, type TravelMode } from '@/types/domain';
import type { TripContext } from '@/features/trips/TripLayout';
import {
  invalidLeg,
  useAddPlace,
  useDeletePlace,
  useLegCalculation,
  usePlaces,
  usePlacesRealtime,
  useUpdatePlaces,
  type Place,
} from './api';
import { AddPlaceSheet, type AddTarget } from './AddPlaceSheet';
import { PlaceSheet, type PlaceAction } from './PlaceSheet';

const MapView = lazy(() => import('./MapView'));
const CalendarView = lazy(() => import('./CalendarView'));
const MODE_ICON = { walk: Footprints, transit: TramFront, drive: Car } as const;
const IDEAS = 'ideas';
const dayId = (i: number) => `day:${i}`;

export function PlanPage() {
  const { trip } = useOutletContext<TripContext>();
  const places = usePlaces(trip.id);
  usePlacesRealtime(trip.id);
  const update = useUpdatePlaces(trip.id);
  const add = useAddPlace(trip.id);
  const del = useDeletePlace(trip.id);

  const total = tripDays(trip.start_date, trip.end_date);
  const grouped = useMemo(() => groupByDay(places.data ?? [], total), [places.data, total]);
  useLegCalculation(trip.id, grouped.days);

  const [params, setParams] = useSearchParams();
  const v0 = params.get('view');
  const view = v0 === 'map' || v0 === 'calendar' ? v0 : 'list';
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [addTarget, setAddTarget] = useState<AddTarget>(null);
  const [selected, setSelected] = useState<Place | null>(null);
  const today = todayYmd();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Writes patches and offers a 5 s undo that restores the touched rows' previous schedule fields. */
  const applyWithUndo = (patches: { id: string; patch: Partial<Place> }[], message: string) => {
    const before = new Map((places.data ?? []).map((p) => [p.id, p]));
    update.mutate(patches);
    toast(message, {
      duration: 5000,
      action: {
        label: copy.plan.undo,
        onClick: () =>
          update.mutate(
            patches.map(({ id }) => {
              const p = before.get(id);
              return {
                id,
                patch: {
                  day_index: p?.day_index ?? null,
                  start_time: p?.start_time ?? null,
                  end_time: p?.end_time ?? null,
                  position: p?.position ?? 0,
                },
              };
            }),
          ),
      },
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const lists: Record<string, Place[]> = { [IDEAS]: grouped.ideas };
    grouped.days.forEach((d, i) => (lists[dayId(i)] = d));
    const from = Object.keys(lists).find((k) => lists[k].some((p) => p.id === active.id));
    const overId = String(over.id);
    const to =
      overId in lists ? overId : Object.keys(lists).find((k) => lists[k].some((p) => p.id === overId));
    if (!from || !to) return;
    const item = lists[from].find((p) => p.id === active.id)!;
    const index = overId in lists ? lists[to].length : lists[to].findIndex((p) => p.id === overId);
    const ordered = insertAt(lists[to], item, index);

    if (to === IDEAS) {
      const patches = ordered.map((p, i) =>
        p.id === item.id
          ? {
              id: p.id,
              patch: {
                day_index: null,
                start_time: null,
                end_time: null,
                position: (i + 1) * 1000,
                ...invalidLeg,
              },
            }
          : { id: p.id, patch: { position: (i + 1) * 1000 } },
      );
      return void update.mutate(patches);
    }

    const dayIndex = Number(to.slice(4));
    const firstStart = dayFirstStart(lists[to]);
    const { patches, overflow } = reflowDay(ordered, firstStart);
    const rows = patches.map((t, i) => ({
      id: t.id,
      patch: {
        day_index: dayIndex,
        start_time: t.start_time,
        end_time: t.end_time,
        position: (i + 1) * 1000,
        ...(t.id === item.id ? invalidLeg : {}),
      },
    }));
    // skip rows that did not change so peers get only the necessary Realtime events
    const cur = new Map((places.data ?? []).map((p) => [p.id, p]));
    const changed = rows.filter(({ id, patch }) => {
      const p = cur.get(id)!;
      return (
        p.day_index !== patch.day_index ||
        hm(p.start_time) !== patch.start_time ||
        hm(p.end_time) !== patch.end_time ||
        p.position !== patch.position
      );
    });
    if (changed.length === 0) return;
    applyWithUndo(changed, copy.plan.reflowed);
    if (overflow) toast.warning(copy.plan.overflow);
  };

  const onAction = (place: Place, a: PlaceAction) => {
    if (a.type === 'delete') return del.mutate(place.id);
    if (a.type === 'note') return update.mutate([{ id: place.id, patch: { note: a.note } }]);
    if (a.type === 'time')
      return update.mutate([
        { id: place.id, patch: { day_index: a.day, start_time: a.start, end_time: a.end, ...invalidLeg } },
      ]);
    if (a.day === null) {
      toast.success(copy.plan.toIdeaDone);
      return update.mutate([
        { id: place.id, patch: { day_index: null, start_time: null, end_time: null, ...invalidLeg } },
      ]);
    }
    moveToDay(place, a.day);
  };

  const moveToDay = (place: Place, day: number) => {
    const slot = nextSlot(grouped.days[day] ?? []);
    const last = (grouped.days[day] ?? []).reduce((m, p) => Math.max(m, p.position), 0);
    update.mutate([
      {
        id: place.id,
        patch: {
          day_index: day,
          start_time: slot.start,
          end_time: slot.end,
          position: last + 1000,
          ...invalidLeg,
        },
      },
    ]);
  };

  const cycleMode = (cur: Place) => {
    const mode = nextMode((cur.leg_mode ?? 'walk') as TravelMode);
    update.mutate([{ id: cur.id, patch: { leg_mode: mode, ...invalidLeg } }]);
  };

  if (places.isPending) {
    return (
      <div className="grid gap-3 p-4" aria-busy>
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (places.isError) {
    return (
      <ErrorState
        message={copy.common.loadFailed}
        onRetry={() => void places.refetch()}
        retryLabel={copy.common.retry}
      />
    );
  }

  return (
    <div className="p-4">
      <h1 className="py-2 text-xl font-bold">{copy.plan.heading}</h1>
      <div
        role="tablist"
        className="mb-3 grid max-w-sm grid-cols-3 gap-1 rounded-full bg-surface p-1 shadow-card"
      >
        {(['list', 'calendar', 'map'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setParams(v === 'list' ? {} : { view: v }, { replace: true })}
            className={`min-h-11 rounded-full text-sm font-semibold ${view === v ? 'bg-hero text-white' : 'text-muted'}`}
          >
            {v === 'list' ? copy.map.viewList : v === 'calendar' ? copy.map.viewCalendar : copy.map.viewMap}
          </button>
        ))}
      </div>

      {view === 'calendar' && (
        <>
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              className={btn.ghost}
              onClick={() => {
                if (grouped.days.every((d) => d.length === 0)) return void toast(copy.plan.csvEmpty);
                downloadCsv(`${trip.title}.csv`, scheduleToCsv(grouped.days));
              }}
            >
              {copy.plan.csv}
            </button>
          </div>
          <Suspense fallback={<Skeleton className="h-80" />}>
            <CalendarView
              days={grouped.days}
              tripStart={trip.start_date}
              onChange={(id, slot) =>
                update.mutate([
                  {
                    id,
                    patch: { day_index: slot.day, start_time: slot.start, end_time: slot.end, ...invalidLeg },
                  },
                ])
              }
              onSelect={(slot) =>
                setAddTarget({
                  dayIndex: slot.day,
                  dayPlaces: grouped.days[slot.day] ?? [],
                  ideas: grouped.ideas,
                  prefill: { start: slot.start, end: slot.end },
                })
              }
              onOpen={(id) => setSelected(places.data?.find((p) => p.id === id) ?? null)}
            />
          </Suspense>
        </>
      )}
      {view === 'map' && googleEnabled && (
        <Suspense fallback={<Skeleton className="h-80" />}>
          <MapView days={grouped.days} />
        </Suspense>
      )}
      {view === 'map' && !googleEnabled && (
        <div role="status" className="mb-3 rounded-card bg-primary-soft p-4">
          <p className="font-bold">{copy.map.needKey}</p>
          <p className="mt-1 text-sm text-muted">{copy.map.needKeyBody}</p>
        </div>
      )}

      {(view === 'list' || (view === 'map' && !googleEnabled)) && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="grid gap-4">
            {grouped.days.map((list, i) => {
              const ymd = dayYmd(trip.start_date, i);
              const open = !collapsed.has(i);
              return (
                <Section
                  key={i}
                  id={dayId(i)}
                  ids={list.map((p) => p.id)}
                  header={
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={`${copy.plan.dayTitle(i + 1)} ${open ? copy.plan.collapse : copy.plan.expand}`}
                        onClick={() =>
                          setCollapsed((s) => {
                            const n = new Set(s);
                            if (n.has(i)) n.delete(i);
                            else n.add(i);
                            return n;
                          })
                        }
                        className="flex min-h-11 flex-1 items-center gap-2 text-left"
                      >
                        <ChevronDown
                          className={`size-5 transition-transform ${open ? '' : '-rotate-90'}`}
                          aria-hidden
                        />
                        <span className="font-bold">
                          {copy.plan.dayTitle(i + 1)} · {formatMdWeekday(ymd)}
                        </span>
                        {ymd === today && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
                            {copy.plan.today}
                          </span>
                        )}
                        <span className="text-sm text-muted">{copy.plan.placeCount(list.length)}</span>
                      </button>
                      <button
                        type="button"
                        className={btn.ghost}
                        onClick={() => setAddTarget({ dayIndex: i, dayPlaces: list, ideas: grouped.ideas })}
                      >
                        <Plus className="size-4" aria-hidden />
                        {copy.plan.add}
                      </button>
                    </div>
                  }
                  open={open}
                  empty={copy.plan.dayEmpty}
                >
                  {list.map((p, idx) => (
                    <li key={p.id} className="grid gap-2">
                      {idx > 0 && <LegChip prev={list[idx - 1]} cur={p} onClick={() => cycleMode(p)} />}
                      <PlaceCard place={p} onMenu={() => setSelected(p)} />
                    </li>
                  ))}
                </Section>
              );
            })}

            <Section
              id={IDEAS}
              ids={grouped.ideas.map((p) => p.id)}
              header={
                <div className="flex items-center gap-1">
                  <h2 className="flex min-h-11 flex-1 items-center gap-2 font-bold">
                    {copy.plan.ideas}{' '}
                    <span className="text-sm font-normal text-muted">
                      {copy.plan.placeCount(grouped.ideas.length)}
                    </span>
                  </h2>
                  <button
                    type="button"
                    className={btn.ghost}
                    onClick={() => setAddTarget({ dayIndex: null, dayPlaces: [], ideas: grouped.ideas })}
                  >
                    <Plus className="size-4" aria-hidden />
                    {copy.plan.add}
                  </button>
                </div>
              }
              open
              empty={copy.plan.ideasEmpty}
            >
              {grouped.ideas.map((p) => (
                <li key={p.id}>
                  <PlaceCard place={p} onMenu={() => setSelected(p)} />
                </li>
              ))}
            </Section>
          </div>
        </DndContext>
      )}

      <AddPlaceSheet
        target={addTarget}
        onClose={() => setAddTarget(null)}
        onAdd={(row) => {
          add.mutate({ ...row, id: crypto.randomUUID(), trip_id: trip.id });
          setAddTarget(null);
        }}
        onPickIdea={(idea) => {
          if (addTarget?.dayIndex != null) moveToDay(idea, addTarget.dayIndex);
          setAddTarget(null);
        }}
      />
      <PlaceSheet
        place={selected}
        days={grouped.days}
        tripStart={trip.start_date}
        onClose={() => setSelected(null)}
        onAction={onAction}
      />
    </div>
  );
}

/** A droppable, sortable column (a day or the idea inbox). Stays droppable when empty. */
function Section({
  id,
  ids,
  header,
  open,
  empty,
  children,
}: {
  id: string;
  ids: string[];
  header: ReactNode;
  open: boolean;
  empty: string;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className="rounded-card bg-surface p-3 shadow-card">
      {header}
      {open && (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="mt-2 grid gap-2 min-h-12">
            {ids.length === 0 ? <li className="py-3 text-center text-sm text-muted">{empty}</li> : children}
          </ul>
        </SortableContext>
      )}
    </section>
  );
}

function PlaceCard({ place, onMenu }: { place: Place; onMenu: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: place.id,
  });
  const timed = place.start_time && place.end_time;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1 rounded-input border border-line bg-surface p-2 ${isDragging ? 'z-10 opacity-70 shadow-card' : ''}`}
    >
      <button
        type="button"
        aria-label={copy.plan.dragHandle}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center text-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p className="tabular text-xs text-muted">
          {timed ? `${hm(place.start_time)} – ${hm(place.end_time)}` : copy.plan.untimed}
        </p>
        <p className="truncate font-semibold">{place.name}</p>
        <p className="flex items-center gap-1.5 text-xs">
          <span className="rounded-full bg-primary-soft px-2 py-0.5 font-semibold text-primary">
            {LABELS_KO[place.category as keyof typeof LABELS_KO] ?? place.category}
          </span>
          {place.note && (
            <span className="inline-flex items-center gap-0.5 text-muted" title={place.note}>
              <StickyNote className="size-3.5" aria-hidden />
              <span className="sr-only">{copy.plan.note}: </span>
              <span className="max-w-40 truncate">{place.note}</span>
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        aria-label={copy.plan.menu}
        onClick={onMenu}
        className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-bg"
      >
        <MoreVertical className="size-5" aria-hidden />
      </button>
    </div>
  );
}

/** Travel chip between two cards. Tap cycles walk → transit → drive and recomputes. */
function LegChip({ prev, cur, onClick }: { prev: Place; cur: Place; onClick: () => void }) {
  const fresh =
    cur.leg_from_place_id === prev.id && cur.leg_duration_s !== null && cur.leg_distance_m !== null;
  if (!fresh) return null;
  const mode = (cur.leg_mode ?? 'walk') as TravelMode;
  const Icon = MODE_ICON[mode];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copy.plan.legChange(copy.plan.legMode[mode])}
      className="mx-auto inline-flex min-h-11 items-center gap-1.5 rounded-full bg-bg px-3 text-xs font-semibold text-muted"
    >
      <Icon className="size-4" aria-hidden />
      {legLabel(cur.leg_duration_s!, cur.leg_distance_m!, cur.leg_estimated)}
    </button>
  );
}

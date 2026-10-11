import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
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
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { copy } from '@/copy';
import { Gauge } from '@/components/Gauge';
import { btn, inputCls } from '@/components/styles';
import { Avatar, ErrorState, Skeleton } from '@/components/ui-kit';
import {
  inSection,
  missingTemplates,
  progress,
  reorderPositions,
  SECTIONS,
  TEMPLATES,
  type Section,
} from '@/lib/checklist';
import { useMembers } from '@/features/trips/api';
import type { TripContext } from '@/features/trips/TripLayout';
import {
  useAddItems,
  useChecklist,
  useDeleteItem,
  useMyMemberId,
  useUpdateItems,
  type ChecklistItem,
} from './api';

export function ChecklistPage() {
  const { trip, me } = useOutletContext<TripContext>();
  const list = useChecklist(trip.id);
  const members = useMembers(trip.id);
  const myMember = useMyMemberId(trip.id, me);
  const add = useAddItems(trip.id);
  const update = useUpdateItems(trip.id);
  const del = useDeleteItem(trip.id);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const items = list.data ?? [];
  const lastPos = (s: Section) => inSection(items, s).reduce((m, i) => Math.max(m, i.position), 0);

  const toggle = (i: ChecklistItem) =>
    update.mutate([{ id: i.id, patch: { checked: !i.checked, checked_by: i.checked ? null : myMember } }]);

  const onDragEnd = (section: Section) => (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ordered = inSection(items, section);
    const to = ordered.findIndex((x) => x.id === e.over!.id);
    update.mutate(
      reorderPositions(ordered, String(e.active.id), to).map(({ id, position }) => ({
        id,
        patch: { position },
      })),
    );
  };

  if (list.isPending)
    return (
      <div className="p-4" aria-busy>
        <Skeleton className="h-56" />
      </div>
    );
  if (list.isError)
    return (
      <ErrorState
        message={copy.common.loadFailed}
        onRetry={() => void list.refetch()}
        retryLabel={copy.common.retry}
      />
    );

  const total = progress(items);
  const before = progress(items, 'before');

  return (
    <div className="p-4">
      <h1 className="py-2 text-xl font-bold">{copy.checklist.heading}</h1>

      <div className="flex justify-around rounded-card bg-surface p-4 shadow-card">
        <Gauge pct={before.pct} label={copy.checklist.gaugeBefore} />
        <Gauge pct={total.pct} label={copy.checklist.gaugeAll} />
      </div>

      {items.length === 0 && (
        <TemplatePicker
          onAdd={(rows) =>
            add.mutate(
              rows.map((r, i) => ({
                ...r,
                id: crypto.randomUUID(),
                trip_id: trip.id,
                position: (i + 1) * 1000,
              })),
            )
          }
        />
      )}

      {SECTIONS.map((section) => {
        const sectionItems = inSection(items, section);
        const p = progress(items, section);
        return (
          <section
            key={section}
            className="mt-4 rounded-card bg-surface p-3 shadow-card"
            aria-label={copy.checklist.sections[section]}
          >
            <header className="flex items-center gap-2 px-1">
              <h2 className="flex-1 font-bold">{copy.checklist.sections[section]}</h2>
              <span className="tabular text-sm font-semibold text-muted">
                {p.done}/{p.total}
              </span>
            </header>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(section)}>
              <SortableContext items={sectionItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="mt-1 grid">
                  {sectionItems.map((i) => (
                    <Row
                      key={i.id}
                      item={i}
                      who={members.data?.find((m) => m.id === i.checked_by)}
                      onToggle={() => toggle(i)}
                      onRename={(title) => update.mutate([{ id: i.id, patch: { title } }])}
                      onDelete={() => del.mutate(i.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <AddInline
              onAdd={(title) =>
                add.mutate([
                  {
                    id: crypto.randomUUID(),
                    trip_id: trip.id,
                    section,
                    title,
                    position: lastPos(section) + 1000,
                  },
                ])
              }
            />
          </section>
        );
      })}
    </div>
  );
}

function Row({
  item,
  who,
  onToggle,
  onRename,
  onDelete,
}: {
  item: ChecklistItem;
  who?: { nickname: string; color: string };
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex min-h-12 items-center gap-1 rounded-input bg-surface ${isDragging ? 'z-10 opacity-70 shadow-card' : ''}`}
    >
      <button
        type="button"
        aria-label={copy.plan.dragHandle}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center text-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      {editing ? (
        <form
          className="flex min-w-0 flex-1 gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const t = draft.trim();
            if (t) onRename(t);
            setEditing(false);
          }}
        >
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the user just chose to edit this field
            autoFocus
            className={inputCls}
            value={draft}
            maxLength={80}
            aria-label={copy.checklist.rename}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className={btn.primary}>
            {copy.common.save}
          </button>
        </form>
      ) : (
        <>
          <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={onToggle}
              className="size-5 shrink-0 accent-[var(--color-primary)]"
            />
            <span className={`truncate ${item.checked ? 'text-muted line-through' : ''}`}>{item.title}</span>
          </label>
          {item.checked && who && (
            <Avatar nickname={who.nickname} color={who.color} className="size-6 text-[10px]" />
          )}
          <button
            type="button"
            aria-label={`${item.title} ${copy.checklist.rename}`}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-bg"
            onClick={() => {
              setDraft(item.title);
              setEditing(true);
            }}
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`${item.title} ${copy.checklist.remove}`}
            className="grid size-11 shrink-0 place-items-center rounded-full text-danger hover:bg-bg"
            onClick={onDelete}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </>
      )}
    </li>
  );
}

function AddInline({ onAdd }: { onAdd: (title: string) => void }) {
  const [title, setTitle] = useState('');
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const t = title.trim();
        if (!t) return;
        onAdd(t);
        setTitle('');
      }}
    >
      <input
        className={inputCls}
        value={title}
        maxLength={80}
        placeholder={copy.checklist.addPlaceholder}
        aria-label={copy.checklist.addPlaceholder}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button
        type="submit"
        aria-label={copy.checklist.add}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-hero text-white disabled:opacity-50"
        disabled={!title.trim()}
      >
        <Plus className="size-5" aria-hidden />
      </button>
    </form>
  );
}

/** Starter list offered when the checklist is empty; nothing is added until the user picks items. */
function TemplatePicker({ onAdd }: { onAdd: (rows: { section: Section; title: string }[]) => void }) {
  const all = SECTIONS.flatMap((s) => TEMPLATES[s].map((title) => ({ section: s, title })));
  const [picked, setPicked] = useState<Set<string>>(new Set(all.map((a) => `${a.section}:${a.title}`)));
  const rows = all.filter((a) => picked.has(`${a.section}:${a.title}`));
  return (
    <section className="mt-4 rounded-card bg-primary-soft p-4">
      <h2 className="font-bold">{copy.checklist.templateTitle}</h2>
      <p className="mt-1 text-sm text-muted">{copy.checklist.templateBody}</p>
      {SECTIONS.map((s) => (
        <fieldset key={s} className="mt-3">
          <legend className="text-sm font-semibold">{copy.checklist.sections[s]}</legend>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {missingTemplates([], s, TEMPLATES[s]).map((t) => {
              const k = `${s}:${t}`;
              return (
                <label key={k} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.has(k)}
                    onChange={() =>
                      setPicked((cur) => {
                        const n = new Set(cur);
                        if (n.has(k)) n.delete(k);
                        else n.add(k);
                        return n;
                      })
                    }
                    className="size-5 accent-[var(--color-primary)]"
                  />
                  {t}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        className={`${btn.primary} mt-3`}
        disabled={rows.length === 0}
        onClick={() => onAdd(rows)}
      >
        {copy.checklist.templateAdd(rows.length)}
      </button>
    </section>
  );
}

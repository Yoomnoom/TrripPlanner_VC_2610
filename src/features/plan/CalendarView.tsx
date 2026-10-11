import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { slotFromDates, toEvents } from '@/lib/calendar';
import { timeToMin } from '@/lib/plan';
import { dayYmd, formatMd } from '@/lib/trip';
import type { Place } from './api';

export type Slot = { day: number; start: string; end: string };

/** Time grid over the real trip dates. Drag/resize/select report back a Day + HH:MM slot. */
export default function CalendarView({
  days,
  tripStart,
  onChange,
  onSelect,
  onOpen,
}: {
  days: Place[][];
  tripStart: string;
  onChange: (placeId: string, slot: Slot) => void;
  onSelect: (slot: Slot) => void;
  onOpen: (placeId: string) => void;
}) {
  const events = useMemo(() => toEvents(days.flat(), tripStart), [days, tripStart]);

  // Default 07:00–24:00; widen when something is scheduled outside that window.
  const { minTime, maxTime } = useMemo(() => {
    const starts = days
      .flat()
      .map((p) => timeToMin(p.start_time))
      .filter((v): v is number => v !== null);
    const lo = Math.min(7 * 60, ...starts.map((m) => Math.floor(m / 60) * 60));
    return { minTime: `${String(lo / 60).padStart(2, '0')}:00:00`, maxTime: '24:00:00' };
  }, [days]);

  const apply = (arg: EventDropArg | EventResizeDoneArg) => {
    const slot = slotFromDates(arg.event.start!, arg.event.end, tripStart, days.length);
    if (!slot) {
      arg.revert();
      return void toast.error(copy.plan.calOutside);
    }
    onChange(arg.event.id, slot);
  };

  const select = (arg: DateSelectArg) => {
    const slot = slotFromDates(arg.start, arg.end, tripStart, days.length);
    if (slot) onSelect(slot);
  };

  return (
    <div className="overflow-hidden rounded-card bg-surface p-2 shadow-card [--fc-border-color:var(--color-line)] [--fc-today-bg-color:var(--color-primary-soft)]">
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="tripGrid"
        views={{ tripGrid: { type: 'timeGrid', duration: { days: days.length }, dayMinWidth: 112 } }}
        initialDate={tripStart}
        locale="ko"
        headerToolbar={false}
        allDaySlot={false}
        height="auto"
        slotMinTime={minTime}
        slotMaxTime={maxTime}
        slotDuration="00:30:00"
        snapDuration="00:15:00"
        nowIndicator
        editable
        selectable
        selectMirror
        longPressDelay={300}
        eventLongPressDelay={300}
        events={events}
        eventDrop={apply}
        eventResize={apply}
        select={select}
        eventClick={(arg) => onOpen(arg.event.id)}
        dayHeaderContent={(arg) => {
          const idx = Math.round(
            (arg.date.getTime() - new Date(`${tripStart}T00:00:00`).getTime()) / 86_400_000,
          );
          return (
            <span className="grid leading-tight">
              <b>{copy.plan.dayTitle(idx + 1)}</b>
              <span className="text-xs font-normal text-muted">{formatMd(dayYmd(tripStart, idx))}</span>
            </span>
          );
        }}
        eventContent={(arg) => (
          <div className="overflow-hidden px-1 text-xs leading-tight">
            <b className="block truncate">{arg.event.title}</b>
            <span className="tabular text-muted">{arg.timeText}</span>
          </div>
        )}
      />
    </div>
  );
}

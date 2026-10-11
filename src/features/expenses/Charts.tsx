import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, XAxis } from 'recharts';
import { copy } from '@/copy';
import { formatCompactKrw, formatKrw } from '@/lib/money';

import { CHART_COLORS } from './chartColors';

export interface Slice {
  key: string;
  label: string;
  krw: number;
  pct: number;
}

/** Donut + a text legend with percentages, so categories are never told apart by color alone. */
export function Donut({ title, slices, center }: { title: string; slices: Slice[]; center: string }) {
  return (
    <figure className="rounded-card bg-surface p-4 shadow-card">
      <figcaption className="font-bold">{title}</figcaption>
      {slices.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{copy.expenses.noData}</p>
      ) : (
        <div className="mt-2 grid items-center gap-3 sm:grid-cols-2">
          <div
            className="relative h-40"
            role="img"
            aria-label={`${title}: ${slices.map((s) => `${s.label} ${s.pct}%`).join(', ')}`}
          >
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="krw"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="100%"
                  stroke="none"
                  isAnimationActive={false}
                >
                  {slices.map((s, i) => (
                    <Cell key={s.key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <span className="pointer-events-none absolute inset-0 grid place-items-center text-center text-sm font-bold">
              {center}
            </span>
          </div>
          <ul className="grid gap-1 text-sm">
            {slices.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="tabular font-semibold">{s.pct}%</span>
                <span className="tabular w-16 text-right text-muted">{formatCompactKrw(s.krw)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}

export function DayBars({ values }: { values: number[] }) {
  const data = values.map((krw, i) => ({ name: `D${i + 1}`, krw }));
  const empty = values.every((v) => v === 0);
  return (
    <div className="h-48" role="img" aria-label={data.map((d) => `${d.name} ${formatKrw(d.krw)}`).join(', ')}>
      {empty ? (
        <p className="py-12 text-center text-sm text-muted">{copy.expenses.noData}</p>
      ) : (
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 18, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
            <Bar dataKey="krw" fill="#6D4AFF" radius={[6, 6, 0, 0]} isAnimationActive={false}>
              <LabelList
                dataKey="krw"
                position="top"
                fontSize={11}
                formatter={(v: unknown) => (typeof v === 'number' && v > 0 ? formatCompactKrw(v) : '')}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

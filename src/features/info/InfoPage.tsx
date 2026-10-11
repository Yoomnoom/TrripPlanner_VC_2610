import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { copy } from '@/copy';
import { inputCls } from '@/components/styles';
import { Field, Skeleton } from '@/components/ui-kit';
import { infoOf } from '@/data/country-info';
import { countryName } from '@/features/footprints/geo';
import type { TripContext } from '@/features/trips/TripLayout';
import { COUNTRIES } from '@/lib/countries';
import { formatKrw, formatMoney } from '@/lib/money';
import { dayYmd, daysBetween, formatMdWeekday, todayYmd } from '@/lib/trip';
import { describeDiff, diffFromKorea, timeIn } from '@/lib/tz';
import { describeCode, NOTE } from '@/lib/weather';
import { useDestinations, useFx, useTripWeather, type Place } from './api';

const OFFICIAL = [{ id: 'safe', label: '외교부 해외안전여행', url: 'https://www.0404.go.kr' }];

const search = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

export function InfoPage() {
  const { trip } = useOutletContext<TripContext>();
  const dests = useDestinations(trip.id);
  const [pickedCountry, setPickedCountry] = useState('');
  const [idx, setIdx] = useState(0);

  // Without a stored destination the user can still look a country up.
  const fallback: Place | null = pickedCountry
    ? {
        countryCode: pickedCountry,
        city: null,
        lat: infoOf(pickedCountry)?.lat ?? null,
        lng: infoOf(pickedCountry)?.lng ?? null,
      }
    : null;
  const place = dests.list[idx] ?? fallback;
  const info = infoOf(place?.countryCode);
  const weather = useTripWeather(trip, place);

  return (
    <div className="p-4 pb-24">
      <h1 className="py-2 text-xl font-bold">{copy.routes.info}</h1>

      {dests.isPending && <Skeleton className="h-24" />}

      {dests.list.length > 1 && (
        <div
          role="tablist"
          className="mb-3 flex gap-1 overflow-x-auto rounded-full bg-surface p-1 shadow-card"
        >
          {dests.list.map((d, i) => (
            <button
              key={`${d.countryCode}-${i}`}
              type="button"
              role="tab"
              aria-selected={idx === i}
              onClick={() => setIdx(i)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${idx === i ? 'bg-hero text-white' : 'text-muted'}`}
            >
              {d.city ?? countryName(d.countryCode ?? '')}
            </button>
          ))}
        </div>
      )}

      {!dests.isPending && dests.list.length === 0 && (
        <div className="mb-3 rounded-card bg-primary-soft p-4">
          <p className="font-semibold">{copy.info.noDestination}</p>
          <Field label={copy.newTrip.country}>
            <select
              className={inputCls}
              value={pickedCountry}
              onChange={(e) => setPickedCountry(e.target.value)}
            >
              <option value="">{copy.newTrip.countryNone}</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {place && info && (
        <div className="grid gap-3">
          <TimeCard place={place} info={info} start={trip.start_date} />
          <WeatherCard weather={weather} tripStart={trip.start_date} dayCount={dayCountOf(trip)} />
          {info.currency !== 'KRW' && <FxCard currency={info.currency} />}
          <BasicsCard info={info} />
          <LinksCard country={place.countryCode ?? ''} />
          <p className="text-xs text-muted">{copy.info.disclaimer}</p>
        </div>
      )}
      {place && !info && <p className="py-8 text-center text-muted">{copy.info.noData}</p>}
    </div>
  );
}

const dayCountOf = (t: { start_date: string; end_date: string }) => daysBetween(t.start_date, t.end_date) + 1;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-surface p-4 shadow-card">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function TimeCard({
  place,
  info,
  start,
}: {
  place: Place;
  info: NonNullable<ReturnType<typeof infoOf>>;
  start: string;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const at = new Date(`${start}T12:00:00Z`);
  return (
    <Card title={copy.info.time}>
      <ul className="grid gap-1">
        {info.timezones.map((z) => (
          <li key={z.tz} className="flex items-baseline justify-between gap-2">
            <span>
              {place.city ?? countryName(place.countryCode ?? '')}
              {z.label && <span className="ml-1 text-xs text-muted">{z.label}</span>}
            </span>
            <span className="tabular text-xl font-extrabold">{timeIn(z.tz, now)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-sm text-muted">{describeDiff(diffFromKorea(info.timezones[0].tz, at))}</p>
    </Card>
  );
}

function WeatherCard({
  weather,
  tripStart,
  dayCount,
}: {
  weather: ReturnType<typeof useTripWeather>;
  tripStart: string;
  dayCount: number;
}) {
  return (
    <Card title={copy.info.weather}>
      {weather.isPending && weather.fetchStatus !== 'idle' && <Skeleton className="h-16" />}
      {weather.data === null && <p className="text-sm text-muted">{copy.info.weatherNone}</p>}
      {weather.isError && <p className="text-sm text-muted">{copy.info.weatherNone}</p>}
      {weather.data && (
        <>
          <p
            role="note"
            className={`mb-2 text-sm font-semibold ${weather.data.plan.kind === 'forecast' ? 'text-muted' : 'text-amber-700'}`}
          >
            {NOTE[weather.data.plan.kind]}
          </p>
          <ul className="grid gap-1">
            {Array.from({ length: dayCount }, (_, i) => {
              const w = weather.data!.byDay.get(i);
              if (!w) return null;
              const d = describeCode(w.code);
              return (
                <li key={i} className="flex min-h-11 items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 font-semibold">
                    {copy.plan.dayTitle(i + 1)}{' '}
                    <span className="text-xs font-normal text-muted">
                      {formatMdWeekday(dayYmd(tripStart, i)).split('(')[0]}
                    </span>
                  </span>
                  <span aria-hidden>{d.icon}</span>
                  <span className="flex-1">{d.label}</span>
                  <span className="tabular">
                    {w.maxC !== null ? `${Math.round(w.maxC)}°` : '–'} /{' '}
                    {w.minC !== null ? `${Math.round(w.minC)}°` : '–'}
                  </span>
                  {w.rainPct !== null && (
                    <span className="tabular w-12 text-right text-xs text-muted">☔ {w.rainPct}%</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

function FxCard({ currency }: { currency: string }) {
  const fx = useFx(currency);
  const [foreign, setForeign] = useState('1000');
  const [krw, setKrw] = useState('');
  const rate = fx.data?.rate ?? null;

  const num = (s: string) => Number(s.replace(/,/g, ''));
  const krwFromForeign = rate !== null && foreign !== '' ? Math.round(num(foreign) * rate) : null;
  const shownKrw = krw !== '' ? krw : krwFromForeign !== null ? String(krwFromForeign) : '';

  const ago = fx.data ? daysBetween(fx.data.date, todayYmd()) : 0;
  return (
    <Card title={copy.info.fx(currency)}>
      {fx.isPending && <Skeleton className="h-16" />}
      {fx.data === null && <p className="text-sm text-muted">{copy.info.fxNone}</p>}
      {fx.data && rate !== null && (
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label={currency}>
              <input
                inputMode="decimal"
                className={inputCls}
                value={foreign}
                onChange={(e) => {
                  setForeign(e.target.value.replace(/[^\d.]/g, ''));
                  setKrw('');
                }}
              />
            </Field>
            <Field label="KRW">
              <input
                inputMode="numeric"
                className={inputCls}
                value={shownKrw}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  setKrw(v);
                  setForeign(v === '' ? '' : String(Math.round((Number(v) / rate) * 100) / 100));
                }}
              />
            </Field>
          </div>
          <p className="text-sm text-muted">
            1 {currency} = {formatKrw(rate)} ·{' '}
            {fx.data.stale ? copy.info.fxStale(Math.max(ago, 0)) : copy.info.fxAsOf(fx.data.date)}
          </p>
          {foreign !== '' && (
            <p className="tabular text-sm">
              {formatMoney(num(foreign), currency)} ≈ {formatKrw(num(shownKrw || '0'))}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function BasicsCard({ info }: { info: NonNullable<ReturnType<typeof infoOf>> }) {
  const rows: [string, string | undefined][] = [
    [copy.info.currency, info.currency],
    [copy.info.languages, info.languages?.join(', ')],
    [
      copy.info.voltage,
      info.voltage && info.frequency ? `${info.voltage} · ${info.frequency}` : info.voltage,
    ],
    [copy.info.plugs, info.plugs?.join(', ')],
    [copy.info.police, info.emergency?.police],
    [copy.info.ambulance, info.emergency?.ambulance],
    [copy.info.emergency, info.emergency?.general],
  ];
  const shown = rows.filter(([, v]) => !!v);
  return (
    <Card title={copy.info.basics}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {shown.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">
        {info.verifiedAt ? copy.info.verifiedAt(info.verifiedAt) : copy.info.unverified}
      </p>
    </Card>
  );
}

function LinksCard({ country }: { country: string }) {
  const name = countryName(country);
  const links = [
    ...OFFICIAL,
    { id: 'embassy', label: `${name} 대한민국 대사관 찾기`, url: search(`${name} 주재 대한민국 대사관`) },
    {
      id: 'visa',
      label: `${name} 비자·입국 규정 (공식 사이트에서 확인)`,
      url: search(`${name} 입국 비자 외교부 해외안전여행`),
    },
  ];
  return (
    <Card title={copy.info.links}>
      <p className="mb-1 text-sm text-muted">{copy.info.linksHint}</p>
      <ul className="grid gap-1">
        {links.map((l) => (
          <li key={l.id}>
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-between rounded-input px-2 font-semibold text-primary hover:bg-bg"
            >
              {l.label}
              <ExternalLink className="size-4" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

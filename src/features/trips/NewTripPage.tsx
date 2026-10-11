import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { Field } from '@/components/ui-kit';
import { btn, inputCls } from '@/components/styles';
import { COUNTRIES } from '@/lib/countries';
import { copyText, getLastNickname, setLastNickname } from '@/lib/device';
import { defaultTitle, inviteUrl, nicknameSchema, todayYmd } from '@/lib/trip';
import { useCreateTrip } from './api';

const toInt = (s: string) => {
  const n = Number(s);
  return s.trim() !== '' && Number.isInteger(n) && n > 0 ? n : undefined;
};

export function NewTripPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const create = useCreateTrip();
  const today = todayYmd();

  const [title, setTitle] = useState('');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [country, setCountry] = useState(params.get('country') ?? '');
  const [city, setCity] = useState('');
  const [nickname, setNickname] = useState(getLastNickname());
  const [headcount, setHeadcount] = useState('');
  const [budget, setBudget] = useState('');

  const dateOk = end >= start;
  const nick = nicknameSchema.safeParse(nickname);
  const placeholder = defaultTitle(city, start, dateOk ? end : start);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!dateOk || !nick.success || create.isPending) return;
    create.mutate(
      {
        title: title.trim() || placeholder,
        start,
        end,
        nickname: nick.data,
        destination: country ? { country_code: country, city: city.trim() || null } : undefined,
        headcount: toInt(headcount),
        budgetKrw: toInt(budget),
      },
      {
        onSuccess: ({ id, inviteToken }) => {
          setLastNickname(nick.data);
          toast.success(copy.newTrip.created, {
            action: inviteToken
              ? {
                  label: copy.newTrip.copyLink,
                  onClick: () => {
                    void copyText(inviteUrl(window.location.origin, inviteToken)).then((ok) =>
                      ok ? toast.success(copy.members.copied) : toast.error(copy.members.copyFailed),
                    );
                  },
                }
              : undefined,
          });
          navigate(`/t/${id}`, { replace: true });
        },
        onError: () => toast.error(copy.newTrip.failed),
      },
    );
  };

  return (
    <main className="mx-auto max-w-xl p-4 pb-12">
      <header className="flex items-center gap-1 py-2">
        <Link
          to="/"
          aria-label={copy.common.back}
          className="grid size-11 place-items-center rounded-full hover:bg-surface"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <h1 className="text-xl font-bold">{copy.newTrip.heading}</h1>
      </header>

      <form onSubmit={onSubmit} className="mt-2 grid gap-4 rounded-card bg-surface p-5 shadow-card">
        <Field label={copy.newTrip.title}>
          <input
            className={inputCls}
            value={title}
            placeholder={placeholder}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={copy.newTrip.start}>
            <input
              type="date"
              required
              className={inputCls}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label={copy.newTrip.end}>
            <input
              type="date"
              required
              className={inputCls}
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>
        {!dateOk && (
          <p role="alert" className="-mt-2 text-sm font-semibold text-danger">
            {copy.newTrip.dateError}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={copy.newTrip.country}>
            <select className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">{copy.newTrip.countryNone}</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={copy.newTrip.city}>
            <input
              className={inputCls}
              value={city}
              maxLength={40}
              disabled={!country}
              onChange={(e) => setCity(e.target.value)}
            />
          </Field>
        </div>

        <Field label={copy.newTrip.nickname} hint={copy.newTrip.nicknameHint}>
          <input
            required
            className={inputCls}
            value={nickname}
            maxLength={20}
            onChange={(e) => setNickname(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={copy.newTrip.headcount}>
            <input
              inputMode="numeric"
              className={inputCls}
              value={headcount}
              onChange={(e) => setHeadcount(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Field label={copy.newTrip.budget}>
            <input
              inputMode="numeric"
              className={inputCls}
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        </div>

        <button type="submit" className={btn.primary} disabled={!dateOk || !nick.success || create.isPending}>
          {create.isPending ? copy.newTrip.creating : copy.newTrip.submit}
        </button>
      </form>
    </main>
  );
}

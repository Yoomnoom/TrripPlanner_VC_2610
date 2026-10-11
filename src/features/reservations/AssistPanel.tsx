import { useState } from 'react';
import { copy } from '@/copy';
import { btn, inputCls } from '@/components/styles';
import { aiErrorMessage, functionErrorCode } from '@/features/chat/api';
import { resizeToJpeg } from '@/lib/image';
import type { ParsedReservation } from '@/lib/reservations';
import { supabase } from '@/lib/supabase';
import { useOnline } from '@/lib/offlineStore';

type Method = 'manual' | 'paste' | 'capture';

/**
 * The three ways to add a reservation. "paste" and "capture" call ai-reservation and hand the result back to be
 * pre-filled in the form; nothing is saved until the user confirms. The pasted text stays in this component only.
 */
export function AssistPanel({
  tripId,
  method,
  onMethod,
  onParsed,
}: {
  tripId: string;
  method: Method;
  onMethod: (m: Method) => void;
  onParsed: (p: ParsedReservation) => void;
}) {
  const online = useOnline();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const run = async (body: Record<string, unknown>) => {
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('ai-reservation', {
        body: { tripId, ...body },
      });
      if (error)
        return setMessage(
          `${aiErrorMessage(await functionErrorCode(error))} ${copy.reservations.fillManually}`,
        );
      const r = (data as { data?: { reservation?: ParsedReservation } } | null)?.data?.reservation;
      if (!r) return setMessage(copy.reservations.fillManually);
      setText(''); // the original text is not kept anywhere
      onParsed(r);
    } catch {
      setMessage(copy.reservations.fillManually);
    } finally {
      setBusy(false);
    }
  };

  const capture = async (file: File) => {
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    try {
      const blob = await resizeToJpeg(file);
      const path = `${tripId}/resv-${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      await run({ imagePath: path }); // the function deletes the image after reading it
    } catch {
      setMessage(copy.reservations.fillManually);
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-full bg-bg p-1">
        {(['manual', 'paste', 'capture'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={method === m}
            onClick={() => onMethod(m)}
            className={`min-h-11 rounded-full text-xs font-semibold sm:text-sm ${method === m ? 'bg-surface shadow-card' : 'text-muted'}`}
          >
            {copy.reservations.methods[m]}
          </button>
        ))}
      </div>

      {method === 'paste' && (
        <div className="grid gap-2">
          <p className="text-xs text-muted">{copy.reservations.pasteHint}</p>
          <textarea
            className={`${inputCls} min-h-32 py-2`}
            value={text}
            maxLength={8000}
            placeholder={copy.reservations.pastePlaceholder}
            aria-label={copy.reservations.methods.paste}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="button"
            className={btn.primary}
            disabled={busy || !online || text.trim() === ''}
            onClick={() => void run({ text })}
          >
            {busy ? copy.reservations.reading : copy.reservations.read}
          </button>
        </div>
      )}
      {method === 'capture' && (
        <div className="grid gap-2">
          <p className="text-xs text-muted">{copy.reservations.captureHint}</p>
          <label className={`${btn.primary} cursor-pointer ${busy ? 'opacity-50' : ''}`}>
            {busy ? copy.reservations.reading : copy.reservations.pickImage}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={busy || !online}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void capture(f);
              }}
            />
          </label>
        </div>
      )}
      {!online && method !== 'manual' && (
        <p role="status" className="text-sm font-semibold text-amber-800">
          {copy.offline.needOnline}
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {message}
        </p>
      )}
    </div>
  );
}

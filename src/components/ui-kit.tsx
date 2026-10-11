import type { ReactNode } from 'react';
import { initialOf } from '@/lib/trip';
import { cn } from '@/lib/utils';
import { btn } from '@/components/styles';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Color circle + initial. The initial (not only the color) identifies the member. */
export function Avatar({
  nickname,
  color,
  className,
}: {
  nickname: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: color }}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white',
        className,
      )}
    >
      {initialOf(nickname)}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-card bg-line', className)} />;
}

export function ErrorState({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <div role="alert" className="grid place-items-center gap-3 p-8 text-center">
      <p className="font-semibold">{message}</p>
      <button type="button" className={btn.primary} onClick={onRetry}>
        {retryLabel}
      </button>
    </div>
  );
}

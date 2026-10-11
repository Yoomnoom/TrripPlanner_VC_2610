export const btn = {
  primary:
    'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-primary px-5 font-semibold text-white disabled:opacity-50',
  dark: 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-hero px-5 font-semibold text-white disabled:opacity-50',
  ghost:
    'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-surface px-5 font-semibold disabled:opacity-50',
  danger:
    'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-danger px-5 font-semibold text-white disabled:opacity-50',
} as const;

export const inputCls =
  'min-h-11 w-full rounded-input border border-line bg-surface px-3.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

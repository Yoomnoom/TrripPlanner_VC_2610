/** Circular progress gauge. The percent is printed in the middle, so color is never the only signal. */
export function Gauge({ pct, label, size = 88 }: { pct: number; label: string; size?: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  return (
    <figure className="grid place-items-center gap-1" role="img" aria-label={`${label} ${pct}%`}>
      <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden>
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--color-line)" strokeWidth="9" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill="currentColor">
          {pct}%
        </text>
      </svg>
      <figcaption className="text-xs font-semibold text-muted">{label}</figcaption>
    </figure>
  );
}

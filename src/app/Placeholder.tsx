import { copy } from '@/copy';

export function Placeholder({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">{copy.common.comingSoon}</p>
    </main>
  );
}

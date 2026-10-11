/** Runs async jobs with at most `limit` in flight (SPEC 4-7: route lookups go through a queue of 3). */
export function createQueue(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  const next = () => {
    active--;
    waiting.shift()?.();
  };
  return async function run<T>(job: () => Promise<T>): Promise<T> {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await job();
    } finally {
      next();
    }
  };
}

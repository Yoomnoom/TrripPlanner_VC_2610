import { describe, expect, it } from 'vitest';
import { createQueue } from '@/lib/queue';
import { manualPlacesProvider } from '@/providers/places';
import { estimateRoutesProvider, withFallback, type RoutesProvider } from '@/providers/routes';

const tokyo = { lat: 35.6812, lng: 139.7671 };
const shibuya = { lat: 35.658, lng: 139.7016 };

describe('manualPlacesProvider', () => {
  it('turns typed text into one candidate and resolves it back', async () => {
    const [c] = await manualPlacesProvider.search('  이치란 라멘 ');
    expect(c.name).toBe('이치란 라멘');
    expect(await manualPlacesProvider.details(c.id)).toMatchObject({ name: '이치란 라멘' });
    expect(await manualPlacesProvider.coords(c.id)).toBeNull();
    expect(await manualPlacesProvider.search('   ')).toEqual([]);
    expect(await manualPlacesProvider.details('ChIJxyz')).toBeNull();
  });
});

describe('routes providers', () => {
  it('estimates are flagged and scale with mode', async () => {
    const walk = await estimateRoutesProvider.getLeg(tokyo, shibuya, 'walk');
    const drive = await estimateRoutesProvider.getLeg(tokyo, shibuya, 'drive');
    expect(walk?.estimated).toBe(true);
    expect(walk!.durationS).toBeGreaterThan(drive!.durationS);
  });
  it('falls back when the primary throws or returns null, and passes real routes through', async () => {
    const real = { durationS: 1, distanceM: 2, estimated: false };
    const make = (f: () => Promise<typeof real | null>): RoutesProvider => ({ id: 'google', getLeg: f });
    expect(
      (
        await withFallback(
          make(async () => {
            throw new Error('x');
          }),
        ).getLeg(tokyo, shibuya, 'walk')
      )?.estimated,
    ).toBe(true);
    expect((await withFallback(make(async () => null)).getLeg(tokyo, shibuya, 'walk'))?.estimated).toBe(true);
    expect(await withFallback(make(async () => real)).getLeg(tokyo, shibuya, 'walk')).toEqual(real);
  });
});

describe('createQueue', () => {
  it('never runs more than the limit at once and finishes everything', async () => {
    const run = createQueue(3);
    let active = 0;
    let peak = 0;
    const job = async () => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return 1;
    };
    const out = await Promise.all(Array.from({ length: 10 }, () => run(job)));
    expect(out).toHaveLength(10);
    expect(peak).toBe(3);
  });
});

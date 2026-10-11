import { describe, it, expect } from 'vitest';
import { haversineM, estimateLeg } from '../src/lib/geo';
import { toMin, toHHmm, reflow } from '../src/lib/time';
import { yearStreak } from '../src/features/footprints/yearStreak';

describe('geo', () => {
  it('서울시청↔강남역 약 8~10km', () => {
    const d = haversineM({ lat: 37.5663, lng: 126.9779 }, { lat: 37.4979, lng: 127.0276 });
    expect(d).toBeGreaterThan(8000);
    expect(d).toBeLessThan(10000);
  });
  it('같은 좌표는 0', () => {
    expect(haversineM({ lat: 35, lng: 139 }, { lat: 35, lng: 139 })).toBe(0);
  });
  it('도보 추정: 1km 직선 → 1.3km, 약 17분', () => {
    const a = { lat: 35.0, lng: 139.0 };
    const b = { lat: 35.0, lng: 139.0 + 1000 / (111320 * Math.cos((35 * Math.PI) / 180)) };
    const r = estimateLeg(a, b, 'walk');
    expect(r.estimated).toBe(true);
    expect(r.distanceM).toBeGreaterThan(1250);
    expect(r.distanceM).toBeLessThan(1350);
    expect(r.durationS / 60).toBeGreaterThan(16);
    expect(r.durationS / 60).toBeLessThan(18.5);
  });
  it('대중교통은 대기 8분 포함', () => {
    const r = estimateLeg({ lat: 35, lng: 139 }, { lat: 35, lng: 139 }, 'transit');
    expect(r.durationS).toBe(8 * 60);
  });
});

describe('time', () => {
  it('toMin/toHHmm 왕복', () => {
    expect(toMin('09:30')).toBe(570);
    expect(toHHmm(570)).toBe('09:30');
    expect(toHHmm(toMin('00:05'))).toBe('00:05');
  });
  it('reflow: 소요시간 유지, 이동 15분 기본', () => {
    const r = reflow(
      [
        { id: 'a', durationMin: 60 },
        { id: 'b', durationMin: 90, legMinFromPrev: 20 },
        { id: 'c', durationMin: 30 },
      ],
      9 * 60,
    );
    expect(r).toEqual([
      { id: 'a', startMin: 540, endMin: 600 },
      { id: 'b', startMin: 620, endMin: 710 },
      { id: 'c', startMin: 725, endMin: 755 },
    ]);
  });
});

describe('yearStreak', () => {
  it('[2024,2025,2026] @2026 → 3', () => expect(yearStreak([2024, 2025, 2026], 2026)).toBe(3));
  it('[2022,2024,2025] @2026 → 2', () => expect(yearStreak([2022, 2024, 2025], 2026)).toBe(2));
  it('[] → 0', () => expect(yearStreak([], 2026)).toBe(0));
  it('[2023] @2026 → 0', () => expect(yearStreak([2023], 2026)).toBe(0));
  it('중복 연도 허용', () => expect(yearStreak([2025, 2025, 2026], 2026)).toBe(2));
});

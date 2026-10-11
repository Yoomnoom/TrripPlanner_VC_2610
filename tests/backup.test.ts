import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackup } from '@/lib/backup';

const sample = () =>
  buildBackup({
    nickname: ' 민수 ',
    trips: [{ id: 't1', title: '도쿄', start_date: '2026-10-09', end_date: '2026-10-12', role: 'owner' }],
    footprints: [
      { kind: 'country', code: 'JP', status: 'visited', period: '2026-10', memo: null },
      { kind: 'region', code: '11010', status: 'wish', period: 'undecided', memo: '서울 종로' },
    ],
    now: new Date('2026-10-12T00:00:00Z'),
  });

describe('backup', () => {
  it('round-trips through JSON', () => {
    const b = sample();
    expect(b.nickname).toBe('민수');
    const r = parseBackup(JSON.stringify(b));
    expect(r).toEqual({ ok: true, backup: b });
  });
  it('rejects non-JSON and wrong shapes (bad status, wrong app, wrong version, oversized fields)', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, reason: 'json' });
    const b = sample();
    expect(parseBackup(JSON.stringify({ ...b, app: 'other' }))).toEqual({ ok: false, reason: 'shape' });
    expect(parseBackup(JSON.stringify({ ...b, version: 2 }))).toEqual({ ok: false, reason: 'shape' });
    expect(
      parseBackup(JSON.stringify({ ...b, footprints: [{ ...b.footprints[0], status: 'maybe' }] })),
    ).toEqual({ ok: false, reason: 'shape' });
    expect(parseBackup(JSON.stringify({ ...b, nickname: 'x'.repeat(21) }))).toEqual({
      ok: false,
      reason: 'shape',
    });
  });
  it('refuses to build a backup from invalid footprints', () => {
    expect(() =>
      buildBackup({
        nickname: null,
        trips: [],
        footprints: [{ kind: 'planet', code: 'X', status: 'visited', period: null, memo: null }],
      }),
    ).toThrow();
  });
});

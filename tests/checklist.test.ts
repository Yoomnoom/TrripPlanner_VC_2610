import { describe, expect, it } from 'vitest';
import {
  inSection,
  missingTemplates,
  pendingPreview,
  progress,
  reorderPositions,
  TEMPLATES,
} from '@/lib/checklist';

const it_ = (id: string, section: string, checked: boolean, position = 0, title = id) => ({
  id,
  section,
  title,
  checked,
  position,
});

describe('progress', () => {
  const items = [
    it_('a', 'before', true),
    it_('b', 'before', false),
    it_('c', 'packing', true),
    it_('d', 'packing', true),
  ];
  it('computes per-section and total percentages', () => {
    expect(progress(items, 'before')).toEqual({ done: 1, total: 2, pct: 50 });
    expect(progress(items, 'packing')).toEqual({ done: 2, total: 2, pct: 100 });
    expect(progress(items)).toEqual({ done: 3, total: 4, pct: 75 });
  });
  it('is 0% with no items', () => {
    expect(progress([])).toEqual({ done: 0, total: 0, pct: 0 });
  });
  it('rounds like the 67% in the reference', () => {
    expect(
      progress([it_('a', 'before', true), it_('b', 'before', true), it_('c', 'before', false)]).pct,
    ).toBe(67);
  });
});

describe('lists', () => {
  it('orders a section by position', () => {
    const l = inSection(
      [it_('b', 'before', false, 2), it_('a', 'before', false, 1), it_('x', 'packing', false, 0)],
      'before',
    );
    expect(l.map((i) => i.id)).toEqual(['a', 'b']);
  });
  it('skips templates that already exist', () => {
    const have = [it_('1', 'before', false, 0, ' 환전 ')];
    expect(missingTemplates(have, 'before', TEMPLATES.before)).not.toContain('환전');
    expect(missingTemplates(have, 'before', TEMPLATES.before)).toHaveLength(TEMPLATES.before.length - 1);
    expect(missingTemplates(have, 'packing', ['환전'])).toEqual(['환전']);
  });
  it('previews pending items, before-departure first', () => {
    const items = [
      it_('p', 'packing', false, 1),
      it_('b1', 'before', true, 1),
      it_('b2', 'before', false, 2),
      it_('b3', 'before', false, 3),
      it_('p2', 'packing', false, 2),
    ];
    expect(pendingPreview(items, 3).map((i) => i.id)).toEqual(['b2', 'b3', 'p']);
  });
  it('reorders positions', () => {
    const l = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(reorderPositions(l, 'a', 2)).toEqual([
      { id: 'b', position: 1000 },
      { id: 'c', position: 2000 },
      { id: 'a', position: 3000 },
    ]);
    expect(reorderPositions(l, 'zzz', 0)).toEqual([]);
  });
});

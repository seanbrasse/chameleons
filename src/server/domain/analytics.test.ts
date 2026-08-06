import { describe, expect, it } from 'vitest';

import { compactCount, summarizeViews } from './analytics';

describe('summarizeViews', () => {
  const today = '2026-08-06';

  it('totals every row regardless of age', () => {
    const rows = [
      { day: '2026-08-06', views: 4 },
      { day: '2026-01-01', views: 10 },
      { day: '2025-06-01', views: 3 },
    ];
    expect(summarizeViews(rows, today).total).toBe(17);
  });

  it('windows last-7 and last-30 inclusively around today', () => {
    const rows = [
      { day: '2026-08-06', views: 1 }, // today
      { day: '2026-07-31', views: 2 }, // 6 days ago -> in 7 and 30
      { day: '2026-07-30', views: 4 }, // 7 days ago -> out of 7, in 30
      { day: '2026-07-08', views: 8 }, // 29 days ago -> in 30
      { day: '2026-07-07', views: 16 }, // 30 days ago -> out of 30
    ];
    const stats = summarizeViews(rows, today);
    expect(stats.last7).toBe(3);
    expect(stats.last30).toBe(15);
    expect(stats.total).toBe(31);
  });

  it('ignores days after today and clamps junk counts', () => {
    const rows = [
      { day: '2026-08-07', views: 99 }, // future -> not in any window
      { day: '2026-08-06', views: -5 }, // clamped to 0
      { day: '2026-08-06', views: 2.9 }, // truncated to 2
    ];
    const stats = summarizeViews(rows, today);
    expect(stats.total).toBe(101); // future still counts toward all-time total
    expect(stats.last7).toBe(2);
  });

  it('is zero across the board with no rows', () => {
    expect(summarizeViews([], today)).toEqual({ total: 0, last7: 0, last30: 0 });
  });
});

describe('compactCount', () => {
  it('leaves small numbers alone and abbreviates large ones', () => {
    expect(compactCount(0)).toBe('0');
    expect(compactCount(999)).toBe('999');
    expect(compactCount(1200)).toBe('1.2k');
    expect(compactCount(18_000)).toBe('18k');
    expect(compactCount(2_140_000)).toBe('2.1M');
  });
});

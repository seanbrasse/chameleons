import { describe, expect, it } from 'vitest';

import { starterIssue } from '@/content/starter';

import { readMetricForm, removeMetric, upsertMetric } from './edit-metrics';

const form = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe('upsertMetric', () => {
  it('appends a new row and trims it', () => {
    const next = upsertMetric(
      starterIssue('Sam', 'sam@example.com'),
      'm-1',
      readMetricForm(form({ value: ' 40% ', label: ' Faster builds ' })),
    );
    expect(next.metrics[0]).toEqual({ id: 'm-1', value: '40%', label: 'Faster builds' });
  });

  it('replaces in place rather than moving the row', () => {
    const issue = starterIssue('Sam', 'sam@example.com');
    const two = upsertMetric(
      upsertMetric(issue, 'm-1', readMetricForm(form({ value: '1', label: 'A' }))),
      'm-2',
      readMetricForm(form({ value: '2', label: 'B' })),
    );

    const updated = upsertMetric(two, 'm-1', readMetricForm(form({ value: '9', label: 'A' })));
    expect(updated.metrics.map((m) => m.id)).toEqual(['m-1', 'm-2']);
    expect(updated.metrics[0]?.value).toBe('9');
  });

  it('does not mutate the issue it was given', () => {
    const issue = starterIssue('Sam', 'sam@example.com');
    upsertMetric(issue, 'm-1', readMetricForm(form({ value: '1', label: 'A' })));
    expect(issue.metrics).toHaveLength(0);
  });
});

describe('removeMetric', () => {
  it('drops only the matching row', () => {
    const issue = starterIssue('Sam', 'sam@example.com');
    const added = upsertMetric(issue, 'm-1', readMetricForm(form({ value: '1', label: 'A' })));
    expect(removeMetric(added, 'm-1').metrics).toHaveLength(0);
    expect(removeMetric(added, 'nope')).toEqual(added);
  });
});

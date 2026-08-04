import type { Issue, Metric } from '@/content/types';

export type MetricEdit = Pick<Metric, 'value' | 'label'>;

export function readMetricForm(get: (name: string) => string | null): MetricEdit {
  const text = (name: string) => (get(name) ?? '').trim();
  return { value: text('value'), label: text('label') };
}

export function upsertMetric(issue: Issue, id: string, edit: MetricEdit): Issue {
  const existing = issue.metrics.find((metric) => metric.id === id);

  if (!existing) {
    return { ...issue, metrics: [...issue.metrics, { id, ...edit }] };
  }

  return {
    ...issue,
    metrics: issue.metrics.map((metric) => (metric.id === id ? { ...existing, ...edit } : metric)),
  };
}

export function removeMetric(issue: Issue, id: string): Issue {
  return { ...issue, metrics: issue.metrics.filter((metric) => metric.id !== id) };
}

import type { AnalyticsMetricKey } from '@food-tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  runInsightsMetricWithDiagnostics,
  type InsightsDiagnosticMetricKey,
} from '../src/modules/analytics/trends/route-diagnostics.js';

const canonicalMetrics: InsightsDiagnosticMetricKey[] = [
  'calories',
  'protein',
  'carbs',
  'fat',
  'macroComposition',
  'weight',
  'hydration',
  'loggingConsistency',
];

function diagnosticCalls(warn: { mock: { calls: unknown[][] } }) {
  return warn.mock.calls
    .filter((call) => call[0] === '[food-tracker:diagnostic]')
    .map((call) => call[1] as Record<string, unknown>);
}

describe('Insights route diagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(canonicalMetrics)(
    'allows the %s metric to complete normally',
    async (metric) => {
      const warn = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const result = await runInsightsMetricWithDiagnostics(
        metric,
        async () => ({ primaryMetric: metric as AnalyticsMetricKey }),
        'req_insights_success_test',
      );

      expect(result).toEqual({ primaryMetric: metric });
      expect(diagnosticCalls(warn)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'insights_metric_started',
            requestId: 'req_insights_success_test',
            operation: 'analytics_insights_metric',
            field: metric,
          }),
          expect.objectContaining({
            category: 'insights_metric_succeeded',
            requestId: 'req_insights_success_test',
            operation: 'analytics_insights_metric',
            field: metric,
          }),
        ]),
      );
    },
  );

  it.each(['hydration', 'loggingConsistency'] as const)(
    'rethrows a %s metric failure and identifies only that metric',
    async (metric) => {
      const warn = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const error = new Error(
        'private@example.com uid=secret database=food_tracker payload=hidden',
      );

      await expect(
        runInsightsMetricWithDiagnostics(
          metric,
          async () => {
            throw error;
          },
          'req_insights_failure_test',
        ),
      ).rejects.toBe(error);

      const diagnostics = diagnosticCalls(warn);
      expect(diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'insights_metric_failed',
            requestId: 'req_insights_failure_test',
            operation: 'analytics_insights_metric',
            field: metric,
            errorClass: 'Error',
            errorCategory: 'exception',
          }),
        ]),
      );
      expect(JSON.stringify(diagnostics)).not.toContain('private@example.com');
      expect(JSON.stringify(diagnostics)).not.toContain('secret');
      expect(JSON.stringify(diagnostics)).not.toContain('hidden');
      expect(JSON.stringify(diagnostics)).not.toContain('stack');
    },
  );
});

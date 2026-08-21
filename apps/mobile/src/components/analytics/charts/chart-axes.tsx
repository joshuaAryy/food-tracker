import { View } from 'react-native';
import type { ReactNode } from 'react';
import type { ChartDomain } from '@/lib/analytics/chart-domain';
import {
  numericAxisTicks,
  selectDateTickIndexes,
} from '@/lib/analytics/chart-axis';
import { formatPresentationDate } from '@/lib/date-time';
import { formatMetricValue } from '@/lib/reporting-ui';
import { AppText } from '@/components/app-text';

export const CHART_AXIS_GUTTER = 48;

export function chartPlotWidth(width: number, showAxes: boolean): number {
  return showAxes ? Math.max(196, width - CHART_AXIS_GUTTER) : width;
}

export function ChartAxes({
  children,
  dates,
  domain,
  height,
  periodDays,
  referenceLabel,
  unit,
  width,
}: {
  children: ReactNode;
  dates: readonly string[];
  domain: ChartDomain | null;
  height: number;
  periodDays?: number | undefined;
  referenceLabel?: string | undefined;
  unit: string;
  width: number;
}) {
  const plotWidth = chartPlotWidth(width, true);
  const yTicks =
    domain === null
      ? []
      : numericAxisTicks(
          { minimum: domain.min, maximum: domain.max },
          { includeZero: domain.min === 0 },
        );
  const xIndexes = selectDateTickIndexes(dates, periodDays);
  return (
    <View className="gap-1">
      <View className="flex-row items-stretch">
        <View
          testID="chart-y-axis"
          className="w-12 justify-between pr-1"
          style={{ height }}
        >
          <AppText variant="caption" className="text-[10px] text-muted">
            {unit}
          </AppText>
          <View className="flex-1 justify-between">
            {[...yTicks].reverse().map((tick) => (
              <AppText
                key={tick}
                variant="caption"
                className="text-right text-[10px] text-muted"
              >
                {formatMetricValue(tick)}
              </AppText>
            ))}
          </View>
        </View>
        <View style={{ width: plotWidth }}>
          {children}
          <View
            testID="chart-x-axis"
            className="flex-row justify-between pt-1"
            style={{ width: plotWidth }}
          >
            {xIndexes.map((index) => {
              const date = dates[index];
              return date === undefined ? null : (
                <AppText
                  key={`${date}-${index}`}
                  variant="caption"
                  className="text-[10px] text-muted"
                >
                  {formatPresentationDate(date)}
                </AppText>
              );
            })}
          </View>
        </View>
      </View>
      {referenceLabel === undefined ? null : (
        <AppText variant="caption" className="text-muted">
          {referenceLabel}
        </AppText>
      )}
    </View>
  );
}

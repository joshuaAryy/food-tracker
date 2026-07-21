import { useMemo, useState } from 'react';
import type {
  ReportsResponse,
  ReportingNutrientGroup,
} from '@food-tracker/shared';
import { ChevronDown, ChevronUp, ListTree } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';
import {
  nutrientDetailsForMode,
  nutrientGroupForDetail,
  nutrientGroupLabel,
} from '@/lib/reporting-ui';
import { colors } from '@/theme/tokens';

const groupOrder: ReportingNutrientGroup[] = [
  'general',
  'carbohydrate_fiber',
  'lipids',
  'protein_amino_acid',
  'vitamins',
  'minerals',
  'other',
];

function formatAmount(value: number, unit: string): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: unit === 'mg' || unit === 'mcg' ? 0 : 1 })} ${unit}`;
}

export function CompleteNutrientReport({
  report,
  title = 'Complete nutrient report',
}: {
  report: Pick<ReportsResponse['current'], 'nutrientDetails'>;
  title?: string;
}) {
  const entries = nutrientDetailsForMode(report, 'complex');
  const grouped = useMemo(() => {
    const result = new Map<ReportingNutrientGroup, typeof entries>();
    for (const group of groupOrder) result.set(group, []);
    for (const entry of entries) {
      const group = nutrientGroupForDetail(entry.detail);
      result.get(group)?.push(entry);
    }
    return result;
  }, [entries]);
  const visibleGroups = groupOrder.filter(
    (group) => (grouped.get(group)?.length ?? 0) > 0,
  );
  const [expanded, setExpanded] = useState<ReportingNutrientGroup | null>(
    visibleGroups[0] ?? null,
  );

  if (visibleGroups.length === 0) return null;

  return (
    <AppCard compact className="gap-3">
      <View className="flex-row items-center gap-2">
        <ListTree color={colors.light.ink} size={18} strokeWidth={2.2} />
        <View className="min-w-0 flex-1">
          <AppText variant="heading" className="text-ink">
            {title}
          </AppText>
          <AppText variant="caption" className="text-muted">
            Recorded nutrients only · totals and averages per logged day.
          </AppText>
        </View>
      </View>
      <View>
        {visibleGroups.map((group) => {
          const isExpanded = expanded === group;
          const groupEntries = grouped.get(group) ?? [];
          return (
            <View key={group} className="border-t border-line">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                accessibilityLabel={`${nutrientGroupLabel(group)} category`}
                className="min-h-12 flex-row items-center gap-3 py-3"
                onPress={() => setExpanded(isExpanded ? null : group)}
              >
                <AppText variant="label" className="min-w-0 flex-1 text-ink">
                  {nutrientGroupLabel(group)}
                </AppText>
                <AppText variant="caption" className="text-muted">
                  {groupEntries.length} recorded
                </AppText>
                {isExpanded ? (
                  <ChevronUp color={colors.light.muted} size={18} />
                ) : (
                  <ChevronDown color={colors.light.muted} size={18} />
                )}
              </Pressable>
              {isExpanded ? (
                <View className="gap-3 pb-3">
                  {groupEntries.map(({ key, detail }) => (
                    <View key={key} className="gap-1 pl-2">
                      <View className="flex-row items-start gap-3">
                        <AppText
                          variant="label"
                          className="min-w-0 flex-1 text-ink"
                        >
                          {detail.displayName}
                        </AppText>
                        <AppText
                          variant="label"
                          className="text-ink tabular-nums"
                        >
                          {formatAmount(
                            detail.averagePerLoggedDay,
                            detail.unit,
                          )}
                        </AppText>
                      </View>
                      <AppText variant="caption" className="text-muted">
                        Total {formatAmount(detail.total, detail.unit)} ·
                        recorded on {detail.recordedDayCount}{' '}
                        {detail.recordedDayCount === 1 ? 'day' : 'days'}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </AppCard>
  );
}

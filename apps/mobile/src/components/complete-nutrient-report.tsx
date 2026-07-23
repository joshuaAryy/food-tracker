import { useEffect, useMemo, useState } from 'react';
import type {
  ReportsResponse,
  ReportingNutrientGroup,
} from '@food-tracker/shared';
import { ChevronDown, ChevronUp, ListTree } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from './app-text';
import {
  initialExpandedGroups,
  nutrientDetailsForMode,
  nutrientGroupForDetail,
  nutrientGroupLabel,
  nutrientPercentageAccessibilityLabel,
  nutrientPercentageLabel,
  nutrientRowCopy,
  toggleExpandedGroup,
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

export function CompleteNutrientReport({
  report,
  title = 'Complete nutrient report',
}: {
  report: Pick<ReportsResponse['current'], 'nutrientDetails'>;
  title?: string;
}) {
  const entries = useMemo(
    () => nutrientDetailsForMode(report, 'complex'),
    [report.nutrientDetails],
  );
  const grouped = useMemo(() => {
    const result = new Map<ReportingNutrientGroup, typeof entries>();
    for (const group of groupOrder) result.set(group, []);
    for (const entry of entries) {
      const group = nutrientGroupForDetail(entry.detail);
      result.get(group)?.push(entry);
    }
    return result;
  }, [entries]);
  const visibleGroups = useMemo(
    () => groupOrder.filter((group) => (grouped.get(group)?.length ?? 0) > 0),
    [grouped],
  );
  const [expandedGroups, setExpandedGroups] = useState<
    Set<ReportingNutrientGroup>
  >(() => new Set(initialExpandedGroups(visibleGroups)));

  useEffect(() => {
    setExpandedGroups(new Set(initialExpandedGroups(visibleGroups)));
  }, [visibleGroups]);

  if (visibleGroups.length === 0) return null;

  return (
    <View className="gap-3 border-t border-line pt-5">
      <View className="gap-3">
        <View className="flex-row items-center gap-2">
          <ListTree color={colors.light.ink} size={18} strokeWidth={2.2} />
          <View className="min-w-0 flex-1">
            <AppText variant="heading" className="text-ink">
              {title}
            </AppText>
            <AppText variant="caption" className="text-muted">
              Recorded nutrients only · totals per logged day.
            </AppText>
          </View>
        </View>
        <View className="flex-row gap-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Expand all nutrient categories"
            className="min-h-10 justify-center py-1 active:opacity-70"
            onPress={() =>
              setExpandedGroups(new Set(initialExpandedGroups(visibleGroups)))
            }
          >
            <AppText variant="caption" className="text-ink">
              Expand all
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Collapse all nutrient categories"
            className="min-h-10 justify-center py-1 active:opacity-70"
            onPress={() => setExpandedGroups(new Set())}
          >
            <AppText variant="caption" className="text-muted">
              Collapse all
            </AppText>
          </Pressable>
        </View>
      </View>
      <View>
        {visibleGroups.map((group) => {
          const isExpanded = expandedGroups.has(group);
          const groupEntries = grouped.get(group) ?? [];
          return (
            <View key={group} className="border-t border-line">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                accessibilityLabel={`${nutrientGroupLabel(group)} category`}
                className="min-h-12 flex-row items-center gap-3 py-3"
                onPress={() =>
                  setExpandedGroups(
                    (current) =>
                      new Set(toggleExpandedGroup([...current], group)),
                  )
                }
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
                  {groupEntries.map(({ key, detail }) => {
                    const percentageInput = {
                      key,
                      average: detail.averagePerLoggedDay,
                      report,
                    };
                    return (
                      <View
                        key={key}
                        className="flex-row items-start gap-3 pl-2"
                      >
                        <View className="min-w-0 flex-1 gap-0.5">
                          <AppText variant="label" className="text-ink">
                            {detail.displayName}
                          </AppText>
                          <AppText variant="caption" className="text-muted">
                            {nutrientRowCopy({ key, detail, report })}
                          </AppText>
                        </View>
                        <AppText
                          accessible
                          accessibilityLabel={nutrientPercentageAccessibilityLabel(
                            percentageInput,
                          )}
                          variant="label"
                          className="pt-0.5 text-ink tabular-nums"
                        >
                          {nutrientPercentageLabel(percentageInput)}
                        </AppText>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

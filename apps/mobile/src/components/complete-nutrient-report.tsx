import { useEffect, useMemo, useState } from 'react';
import type {
  ReportsResponse,
  ReportingNutrientGroup,
} from '@food-tracker/shared';
import { Pressable, View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';
import { ReportingSectionHeading } from './reporting-section-heading';
import { ReportingChevron } from './reporting-icon';
import {
  initialExpandedGroups,
  nutrientDetailsForMode,
  nutrientGroupForDetail,
  nutrientGroupLabel,
  nutrientPresentation,
  toggleExpandedGroup,
} from '@/lib/reporting-ui';

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
  setupComplete = true,
}: {
  report: Pick<
    ReportsResponse['current'],
    'nutrientDetails' | 'proteinTargetGrams' | 'proteinAdherence'
  >;
  title?: string;
  setupComplete?: boolean;
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
    <View className="gap-3">
      <ReportingSectionHeading
        icon="report"
        title={title}
        compact
        subtitle="Recorded nutrients are grouped by category. Missing goals are labelled clearly."
      />
      <AppCard elevated>
        <View className="mb-2 flex-row justify-end gap-4">
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
        {visibleGroups.map((group) => {
          const isExpanded = expandedGroups.has(group);
          const groupEntries = grouped.get(group) ?? [];
          return (
            <View
              key={group}
              className="border-t border-line py-3 first:border-t-0"
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
                accessibilityLabel={`${nutrientGroupLabel(group)} category`}
                className="min-h-10 flex-row items-center gap-3"
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
                  <ReportingChevron direction="up" />
                ) : (
                  <ReportingChevron direction="down" />
                )}
              </Pressable>
              {isExpanded ? (
                <View className="gap-3 pt-3">
                  {groupEntries.map(({ key, detail }) => {
                    const presentation = nutrientPresentation({
                      key,
                      detail,
                      report,
                      setupComplete,
                    });
                    return (
                      <View key={key} className="flex-row items-start gap-3">
                        <View className="min-w-0 flex-1 gap-1">
                          <AppText variant="label" className="text-ink">
                            {detail.displayName}
                          </AppText>
                          <AppText variant="caption" className="text-muted">
                            {presentation.totalLabel}
                          </AppText>
                        </View>
                        <AppText
                          accessible
                          accessibilityLabel={`${detail.displayName}: ${presentation.statusLabel}`}
                          variant="caption"
                          className="max-w-[140px] pt-0.5 text-right text-ink"
                        >
                          {presentation.statusLabel}
                        </AppText>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </AppCard>
    </View>
  );
}

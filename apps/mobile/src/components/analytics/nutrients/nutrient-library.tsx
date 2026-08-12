import { useMemo, useState } from 'react';
import type {
  AnalyticsMetricDefinition,
  AnalyticsMetricKey,
  ReportingNutrientGroup,
  ReportsResponse,
} from '@food-tracker/shared';
import {
  NUTRIENT_CATALOG,
  NUTRIENT_KEYS,
  analyticsMetricForKey,
  reportingNutrientGroupForCategory,
} from '@food-tracker/shared';
import { Pressable, TextInput, View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { searchAnalyticsMetrics } from '@/lib/analytics/nutrient-search';
import {
  nutrientGroupLabel,
  nutrientPresentation,
  nutrientPresentationAccessibilityLabel,
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

type NutrientDetail = NonNullable<
  ReportsResponse['current']['nutrientDetails']
>[string];

function nutrientDefinitions(): AnalyticsMetricDefinition[] {
  return NUTRIENT_KEYS.filter((key) => key !== 'water').map((key) =>
    analyticsMetricForKey(key),
  );
}

function metricLabel(definition: AnalyticsMetricDefinition): string {
  return definition.displayName;
}

type AttentionStatus = Extract<
  NutrientDetail['status'],
  'below_target' | 'above_target' | 'below_minimum' | 'above_limit'
>;

const attentionStatuses: readonly AttentionStatus[] = [
  'above_limit',
  'below_minimum',
  'below_target',
  'above_target',
];

function attentionLabel(status: AttentionStatus): string {
  switch (status) {
    case 'above_limit':
      return 'Above limit';
    case 'below_minimum':
      return 'Below minimum';
    case 'below_target':
      return 'Below target';
    case 'above_target':
      return 'Above target';
  }
}

function NutrientRow({
  definition,
  detail,
  setupComplete,
  onPress,
}: {
  definition: AnalyticsMetricDefinition;
  detail: NutrientDetail | undefined;
  setupComplete: boolean;
  onPress: () => void;
}) {
  const presentation = nutrientPresentation({
    key: definition.key,
    detail: detail ?? null,
    report: {
      nutrientDetails: detail === undefined ? {} : { [definition.key]: detail },
    },
    setupComplete,
  });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nutrientPresentationAccessibilityLabel({
        displayName: metricLabel(definition),
        presentation,
      })}
      className="min-h-12 flex-row items-center justify-between border-t border-line py-3 active:opacity-70"
      onPress={onPress}
    >
      <AppText variant="label" className="min-w-0 flex-1">
        {metricLabel(definition)}
      </AppText>
      <View className="items-end gap-0.5">
        <AppText variant="caption" className="text-muted tabular-nums">
          {presentation.totalLabel}
        </AppText>
        <AppText variant="caption" className="text-muted">
          ›
        </AppText>
      </View>
    </Pressable>
  );
}

function CategoryCard({
  group,
  definitions,
  details,
  onPress,
}: {
  group: ReportingNutrientGroup;
  definitions: readonly AnalyticsMetricDefinition[];
  details: ReportsResponse['current']['nutrientDetails'];
  onPress: () => void;
}) {
  const recordedCount = definitions.filter((definition) =>
    Object.prototype.hasOwnProperty.call(details, definition.key),
  ).length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${nutrientGroupLabel(group)} category`}
      className="min-h-[58px] flex-row items-center justify-between border-t border-line py-3 active:opacity-70"
      onPress={onPress}
    >
      <AppText variant="label" className="min-w-0 flex-1">
        {nutrientGroupLabel(group)}
      </AppText>
      <AppText variant="caption" className="text-muted">
        {recordedCount} recorded&nbsp; ›
      </AppText>
    </Pressable>
  );
}

function AttentionRow({
  definition,
  detail,
  onPress,
}: {
  definition: AnalyticsMetricDefinition;
  detail: NutrientDetail;
  onPress: () => void;
}) {
  const status = detail.status as AttentionStatus;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${definition.displayName}, ${attentionLabel(status)}`}
      className="min-h-14 flex-row items-center justify-between rounded-[12px] bg-[#FFF5F4] px-3 py-2 active:opacity-70"
      onPress={onPress}
    >
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <AppText className="text-[#E3342F]">△</AppText>
        <AppText variant="label" className="min-w-0 flex-1">
          {definition.displayName}
        </AppText>
      </View>
      <View className="flex-row items-center gap-2">
        <AppText variant="caption" className="text-[#D72620]">
          {attentionLabel(status)}
        </AppText>
        <AppText variant="caption" className="text-muted">
          ›
        </AppText>
      </View>
    </Pressable>
  );
}

export function NutrientLibrary({
  report,
  category,
  initialQuery = '',
  loading,
  error,
  onBack,
  onRetry,
  onOpenMetric,
  onOpenCategory,
}: {
  report: ReportsResponse | null;
  category: ReportingNutrientGroup | null;
  initialQuery?: string;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
  onOpenMetric: (metric: AnalyticsMetricKey) => void;
  onOpenCategory: (category: ReportingNutrientGroup) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(initialQuery !== '');
  const [query, setQuery] = useState(initialQuery);
  const definitions = useMemo(() => nutrientDefinitions(), []);
  const details = report?.current.nutrientDetails ?? {};
  const setupComplete = report !== null && report.goalDirection !== null;
  const visibleDefinitions = useMemo(() => {
    if (category !== null) {
      return definitions.filter(
        (definition) =>
          reportingNutrientGroupForCategory(
            NUTRIENT_CATALOG[definition.key as keyof typeof NUTRIENT_CATALOG]
              .category,
          ) === category,
      );
    }
    return searchAnalyticsMetrics(query, definitions);
  }, [category, definitions, query]);
  const grouped = useMemo(() => {
    const groups = new Map<
      ReportingNutrientGroup,
      AnalyticsMetricDefinition[]
    >();
    for (const definition of visibleDefinitions) {
      const group = reportingNutrientGroupForCategory(
        NUTRIENT_CATALOG[definition.key as keyof typeof NUTRIENT_CATALOG]
          .category,
      );
      groups.set(group, [...(groups.get(group) ?? []), definition]);
    }
    return groups;
  }, [visibleDefinitions]);
  const attentionEntries = useMemo(
    () =>
      definitions
        .map((definition) => ({
          definition,
          detail: details[definition.key],
        }))
        .filter(
          (
            entry,
          ): entry is {
            definition: AnalyticsMetricDefinition;
            detail: NutrientDetail & { status: AttentionStatus };
          } =>
            entry.detail !== undefined &&
            attentionStatuses.includes(entry.detail.status as AttentionStatus),
        )
        .sort(
          (left, right) =>
            attentionStatuses.indexOf(left.detail.status as AttentionStatus) -
            attentionStatuses.indexOf(right.detail.status as AttentionStatus),
        ),
    [definitions, details],
  );

  if (loading) {
    return (
      <View testID="nutrient-library" className="gap-4">
        <AppText variant="title">Complete nutrient report</AppText>
        <AppCard className="bg-module p-4">
          <AppText variant="caption" className="text-muted">
            Loading nutrient library…
          </AppText>
        </AppCard>
      </View>
    );
  }
  if (error !== null) {
    return (
      <View testID="nutrient-library" className="gap-4">
        <ErrorState
          title="Nutrient library unavailable"
          message={error}
          onRetry={onRetry}
        />
      </View>
    );
  }

  if (searchOpen) {
    return (
      <View testID="nutrient-library-search" className="gap-5">
        <View className="flex-row items-center gap-3">
          <TextInput
            autoFocus
            accessibilityLabel="Search nutrients"
            className="min-h-11 flex-1 rounded-[14px] bg-module px-4 text-ink"
            placeholder="Search nutrients"
            placeholderTextColor="#777777"
            value={query}
            onChangeText={setQuery}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel nutrient search"
            className="min-h-11 justify-center"
            onPress={() => {
              setQuery('');
              setSearchOpen(false);
            }}
          >
            <AppText variant="label">Cancel</AppText>
          </Pressable>
        </View>
        <AppText variant="caption" className="text-muted">
          Results update with each character using nutrient aliases and category
          terms.
        </AppText>
        {visibleDefinitions.length === 0 ? (
          <AppCard className="bg-module p-4">
            <AppText variant="caption" className="text-muted">
              No matching nutrients.
            </AppText>
          </AppCard>
        ) : (
          <AppCard elevated className="gap-0 p-[18px]">
            {visibleDefinitions.map((definition) => (
              <NutrientRow
                key={definition.key}
                definition={definition}
                detail={details[definition.key]}
                setupComplete={setupComplete}
                onPress={() => onOpenMetric(definition.key)}
              />
            ))}
          </AppCard>
        )}
      </View>
    );
  }

  return (
    <View testID="nutrient-library" className="gap-7">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          category === null ? 'Back to Nutrients' : 'Back to nutrient library'
        }
        className="min-h-11 self-start justify-center"
        onPress={onBack}
      >
        <AppText variant="label">
          ‹ {category === null ? 'Nutrients' : 'Library'}
        </AppText>
      </Pressable>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <AppText variant="title" className="text-[30px] leading-9">
            {category === null
              ? 'Complete nutrient report'
              : nutrientGroupLabel(category)}
          </AppText>
          <AppText variant="caption" className="text-muted">
            {category === null
              ? 'Browse every supported nutrient. Attention states are prioritized; normal states stay quiet.'
              : 'Daily nutrient status and trends'}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search nutrients"
          className="h-11 w-11 items-center justify-center rounded-full bg-module active:opacity-70"
          onPress={() => setSearchOpen(true)}
        >
          <AppText variant="heading" className="text-[20px] leading-6">
            ⌕
          </AppText>
        </Pressable>
      </View>
      {category === null ? (
        <View className="gap-2">
          <AppText variant="caption" className="font-bold text-muted">
            NEEDS ATTENTION
          </AppText>
          <AppCard className="gap-1 bg-module p-2">
            {attentionEntries.length === 0 ? (
              <AppText variant="caption" className="p-2 text-muted">
                No nutrient needs attention in this period.
              </AppText>
            ) : (
              attentionEntries.map(({ definition, detail }) => (
                <AttentionRow
                  key={definition.key}
                  definition={definition}
                  detail={detail}
                  onPress={() => onOpenMetric(definition.key)}
                />
              ))
            )}
          </AppCard>
        </View>
      ) : null}
      <View className="gap-2">
        <AppText variant="caption" className="font-bold text-muted">
          {category === null ? 'CATEGORIES' : 'ALL NUTRIENTS'}
        </AppText>
        <AppCard elevated className="gap-0 p-3">
          {category === null
            ? groupOrder.map((group) => {
                const groupDefinitions = definitions.filter(
                  (definition) =>
                    grouped
                      .get(group)
                      ?.some((item) => item.key === definition.key) ||
                    reportingNutrientGroupForCategory(
                      NUTRIENT_CATALOG[
                        definition.key as keyof typeof NUTRIENT_CATALOG
                      ].category,
                    ) === group,
                );
                return (
                  <CategoryCard
                    key={group}
                    group={group}
                    definitions={groupDefinitions}
                    details={details}
                    onPress={() => onOpenCategory(group)}
                  />
                );
              })
            : visibleDefinitions.map((definition) => (
                <NutrientRow
                  key={definition.key}
                  definition={definition}
                  detail={details[definition.key]}
                  setupComplete={setupComplete}
                  onPress={() => onOpenMetric(definition.key)}
                />
              ))}
        </AppCard>
      </View>
      <AppText variant="caption" className="text-muted">
        {category === null
          ? 'Near-goal and within-range states remain visually quiet until a nutrient is opened.'
          : 'Rows stay neutral unless the nutrient needs action. Tap any nutrient to open its detail report.'}
      </AppText>
    </View>
  );
}

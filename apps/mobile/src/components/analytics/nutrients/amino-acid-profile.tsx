import { Pressable, View } from 'react-native';
import {
  analyticsMetricForKey,
  type AnalyticsMetricKey,
  type CanonicalTrendResponse,
} from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';

const essentialMetrics = [
  'histidine',
  'isoleucine',
  'leucine',
  'lysine',
  'methionine',
  'phenylalanine',
  'threonine',
  'tryptophan',
  'valine',
] as const satisfies readonly AnalyticsMetricKey[];

export function AminoAcidProfile({
  profile,
  onOpenMetric,
}: {
  profile: NonNullable<CanonicalTrendResponse['aminoAcidProfile']>;
  onOpenMetric: (metric: AnalyticsMetricKey) => void;
}) {
  const entries = new Map(
    profile.entries.map((entry) => [entry.metric, entry]),
  );
  const essential = essentialMetrics.flatMap((metric) => {
    const entry = entries.get(metric);
    return entry === undefined ? [] : [{ metric, entry }];
  });
  const metCount = essential.filter(
    ({ entry }) => entry.status === 'meets_minimum',
  ).length;
  return (
    <View testID="amino-acid-profile" className="gap-5">
      <View className="gap-1">
        <AppText variant="title">Protein &amp; amino acids</AppText>
        <AppText muted>
          Essential amino acids first; individual rows open their own trend.
        </AppText>
      </View>
      <View className="gap-2">
        <AppText variant="label">Essential amino acid profile</AppText>
        <AppCard elevated className="gap-0 p-4">
          <AppText variant="label" className="pb-3">
            {metCount} of {essential.length} are at least 90% of target
          </AppText>
          {essential.map(({ metric, entry }) => {
            const definition = analyticsMetricForKey(metric);
            return (
              <Pressable
                key={metric}
                accessibilityRole="button"
                accessibilityLabel={`Open ${definition.displayName} trend`}
                className="gap-2 border-b border-border py-3 last:border-b-0"
                onPress={() => onOpenMetric(metric)}
              >
                <View className="flex-row items-center justify-between gap-3">
                  <AppText variant="label">{definition.displayName}</AppText>
                  <View className="flex-row items-center gap-3">
                    <AppText variant="caption" className="text-muted">
                      {entry.average === null
                        ? 'Unknown'
                        : `${entry.average} ${definition.unit}`}
                    </AppText>
                    <AppText
                      variant="caption"
                      className={
                        entry.status === 'below_minimum'
                          ? 'text-[#D72620]'
                          : 'text-muted'
                      }
                    >
                      {entry.percentage === null
                        ? 'Unknown'
                        : `${Math.round(entry.percentage)}%`}
                    </AppText>
                  </View>
                </View>
                <View className="h-1.5 overflow-hidden rounded-full bg-module">
                  <View
                    className={
                      entry.status === 'below_minimum'
                        ? 'h-1.5 rounded-full bg-[#D72620]'
                        : 'h-1.5 rounded-full bg-primary'
                    }
                    style={{
                      width: `${Math.max(0, Math.min(100, entry.percentage ?? 0))}%`,
                    }}
                  />
                </View>
              </Pressable>
            );
          })}
          <AppText variant="caption" className="pt-3 text-muted">
            Tap any amino acid to open its 7D / 30D / 90D trend.
          </AppText>
        </AppCard>
      </View>
      <AppText variant="label">Non-essential amino acids</AppText>
      <AppCard compact>
        <AppText variant="label">
          {Math.max(0, profile.entries.length - essential.length)} recorded
          amino acids
        </AppText>
      </AppCard>
    </View>
  );
}

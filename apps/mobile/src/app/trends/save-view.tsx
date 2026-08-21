import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { LineTrendChart } from '@/components/analytics/charts/line-trend-chart';
import type { CanonicalTrendResponse } from '@food-tracker/shared';
import {
  autoSavedViewName,
  savedViewInputFromTrend,
  savedViewUpdateInputFromTrend,
  trendQueryFromRouteParam,
} from '@/lib/analytics/saved-view-configuration';

export default function SaveViewScreen() {
  const router = useRouter();
  const { query: rawQuery, savedViewId } = useLocalSearchParams<{
    query?: string;
    savedViewId?: string;
  }>();
  const trend = useMemo(() => trendQueryFromRouteParam(rawQuery), [rawQuery]);
  const [name, setName] = useState(() =>
    trend === null
      ? ''
      : autoSavedViewName({
          primaryMetric: trend.primaryMetric,
          comparisonMetric: trend.comparisonMetric,
          periodDays: trend.period.kind === 'relative' ? trend.period.days : 0,
        }),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pinOnCreate, setPinOnCreate] = useState(false);
  const [preview, setPreview] = useState<CanonicalTrendResponse | null>(null);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/trends/saved-views' as never);
  };

  const save = async (asNew: boolean) => {
    if (trend === null) return;
    setSaving(true);
    setError(null);
    try {
      if (savedViewId !== undefined && !asNew) {
        await api.analytics.updateSavedView(
          savedViewId,
          savedViewUpdateInputFromTrend(trend, name),
        );
      } else {
        const savedView = await api.analytics.createSavedView(
          savedViewInputFromTrend(trend, name),
        );
        if (pinOnCreate) {
          await api.analytics.updatePreferences({
            pinnedSavedViewId: savedView.id,
          });
        }
      }
      router.replace('/trends/saved-views' as never);
    } catch (cause) {
      setError(errorMessage(cause));
      setSaving(false);
    }
  };

  useEffect(() => {
    if (savedViewId === undefined || trend === null) return;
    let active = true;
    void api.analytics
      .trend({ ...trend, includeForecast: false })
      .then((response) => {
        if (active) setPreview(response);
      })
      .catch(() => {
        if (active) setPreview(null);
      });
    return () => {
      active = false;
    };
  }, [savedViewId, trend]);

  if (trend === null) {
    return (
      <AppScreen>
        <ErrorState
          title="Saved view is unavailable"
          message="This Trend configuration could not be restored."
          onRetry={close}
        />
      </AppScreen>
    );
  }

  const isModified = savedViewId !== undefined;
  return (
    <AppScreen
      backgroundColor={isModified ? '#FFFFFF' : '#EBEBE8'}
      contentClassName={`gap-6 rounded-t-[28px] pb-8 ${isModified ? 'pt-6' : 'pt-4'}`}
      footer={
        <View className="gap-2">
          {savedViewId === undefined ? null : (
            <AppButton
              loading={saving}
              accessibilityLabel="Update existing view"
              onPress={() => void save(false)}
            >
              Update existing
            </AppButton>
          )}
          <AppButton
            variant={isModified ? 'secondary' : 'primary'}
            loading={saving}
            accessibilityLabel={
              savedViewId === undefined ? 'Save view' : 'Save as new view'
            }
            onPress={() => void save(true)}
          >
            {isModified ? 'Save as new view' : 'Save view'}
          </AppButton>
        </View>
      }
    >
      {isModified ? null : (
        <View className="h-1 w-[58px] self-center rounded-full bg-[#C7C7BF]" />
      )}
      <ScreenHeader
        title={isModified ? name : 'Save view'}
        subtitle={
          isModified
            ? `Loaded saved view · changed from ${trend.period.kind === 'relative' ? `${trend.period.days}D` : 'custom range'}`
            : 'Save this configuration so it can be reopened without rebuilding it.'
        }
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={close}
          >
            <AppText variant="label">
              {isModified ? '‹ Saved views' : 'Cancel'}
            </AppText>
          </Pressable>
        }
      />
      {error === null ? null : (
        <ErrorState
          message={error}
          onRetry={() => void save(savedViewId === undefined)}
        />
      )}
      {isModified ? (
        <>
          <View className="flex-row items-center justify-between gap-3">
            <AppText variant="title" numberOfLines={2}>
              {name}
            </AppText>
            <View className="rounded-full bg-[#FFF5E0] px-3 py-2">
              <AppText variant="caption" className="text-[#EB941A]">
                Modified
              </AppText>
            </View>
          </View>
          <View className="gap-3 rounded-[20px] border border-border bg-surface p-[18px]">
            <AppText
              variant="caption"
              className="font-bold uppercase text-muted"
            >
              {trend.period.kind === 'relative'
                ? `${trend.period.days}-day preview`
                : 'Custom-range preview'}
            </AppText>
            {preview === null ? (
              <AppText muted>
                Preview unavailable. Your saved configuration remains editable.
              </AppText>
            ) : (
              <LineTrendChart
                data={preview.points.map((point) => ({
                  date:
                    point.kind === 'daily' ? point.date : point.bucketStartDate,
                  value: point.value,
                }))}
                width={320}
                color="#C9242D"
                accessibilityLabel={`${name} preview`}
              />
            )}
          </View>
          <AppText muted>
            Your changes are temporary until you choose what to do with this
            saved view.
          </AppText>
        </>
      ) : (
        <>
          <AppInput
            label="View name"
            value={name}
            maxLength={80}
            onChangeText={setName}
            accessibilityLabel="View name"
          />
          <AppCard className="gap-2 bg-module">
            <AppText variant="label">Saved range</AppText>
            <AppText>
              {trend.period.kind === 'relative'
                ? `Last ${trend.period.days} days`
                : 'Custom range'}
            </AppText>
            <AppText variant="caption" muted>
              Keeps moving forward with time
            </AppText>
          </AppCard>
          <AppCard className="gap-2 bg-module">
            <AppText variant="label">This view remembers</AppText>
            <AppText variant="caption" muted>
              {name} · {trend.aggregation} · {trend.visualization} ·{' '}
              {trend.showReference ? 'Targets shown' : 'No target'} ·{' '}
              {trend.coverageFilter.replaceAll('_', ' ')}
            </AppText>
          </AppCard>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Pin to Insights"
            accessibilityState={{ checked: pinOnCreate }}
            className="min-h-[64px] flex-row items-center justify-between rounded-[16px] bg-module px-4"
            onPress={() => setPinOnCreate((value) => !value)}
          >
            <View className="gap-0.5">
              <AppText variant="label">Pin to Insights</AppText>
              <AppText variant="caption" muted>
                Replaces the current primary pinned preview
              </AppText>
            </View>
            <AppText variant="label">{pinOnCreate ? 'On' : 'Off'}</AppText>
          </Pressable>
        </>
      )}
    </AppScreen>
  );
}

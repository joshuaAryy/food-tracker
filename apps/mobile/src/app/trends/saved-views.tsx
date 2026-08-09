import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  AnalyticsMetricDefinition,
  AnalyticsSavedView,
} from '@food-tracker/shared';
import { AppScreen } from '@/components/app-screen';
import { AppInput } from '@/components/app-input';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { api, errorMessage } from '@/lib/api-client';
import {
  trendQueryFromSavedView,
  trendQueryRouteParam,
} from '@/lib/analytics/saved-view-configuration';

export default function SavedViewsScreen() {
  const router = useRouter();
  const [views, setViews] = useState<AnalyticsSavedView[]>([]);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replacementMetrics, setReplacementMetrics] = useState<
    AnalyticsMetricDefinition[]
  >([]);
  const load = useCallback(async () => {
    try {
      const [savedViews, preferences] = await Promise.all([
        api.analytics.savedViews(),
        api.analytics.preferences(),
      ]);
      setViews(savedViews);
      setPinnedId(preferences.pinnedSavedViewId);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const duplicate = async (id: string) => {
    setError(null);
    try {
      await api.analytics.duplicateSavedView(id);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  const remove = async (id: string) => {
    setError(null);
    try {
      await api.analytics.deleteSavedView(id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  const rename = async (id: string) => {
    const name = editingName.trim();
    if (name.length === 0) return;
    setError(null);
    try {
      const savedView = await api.analytics.updateSavedView(id, { name });
      setViews((current) =>
        current.map((view) => (view.id === id ? savedView : view)),
      );
      setEditingId(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  const reorder = async (id: string, direction: -1 | 1) => {
    const index = views.findIndex((view) => view.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= views.length) return;
    const reordered = [...views];
    const [moved] = reordered.splice(index, 1);
    if (moved === undefined) return;
    reordered.splice(target, 0, moved);
    setError(null);
    try {
      setViews(
        await api.analytics.reorderSavedViews({
          ids: reordered.map((view) => view.id),
        }),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  const togglePin = async (id: string) => {
    setError(null);
    try {
      const preferences = await api.analytics.updatePreferences({
        pinnedSavedViewId: pinnedId === id ? null : id,
      });
      setPinnedId(preferences.pinnedSavedViewId);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  const canReplaceMetric = (
    view: AnalyticsSavedView,
    metric: AnalyticsMetricDefinition,
  ) =>
    metric.complexAvailable &&
    metric.supportedAggregations.includes(
      view.aggregation as (typeof metric.supportedAggregations)[number],
    ) &&
    metric.supportedVisualizations.includes(
      view.visualization as (typeof metric.supportedVisualizations)[number],
    ) &&
    metric.supportedCoverageFilters.includes(
      view.coverageFilter as (typeof metric.supportedCoverageFilters)[number],
    );
  const beginReplacement = async (view: AnalyticsSavedView) => {
    setError(null);
    try {
      const catalog = await api.analytics.trendCatalog();
      if (catalog.mode !== 'complex') {
        setError('Saved view replacements are available in Complex mode only.');
        return;
      }
      setReplacementMetrics(
        catalog.metrics.filter((metric) => canReplaceMetric(view, metric)),
      );
      setReplacingId(view.id);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  const replaceMetric = async (
    view: AnalyticsSavedView,
    primaryMetric: AnalyticsMetricDefinition['key'],
  ) => {
    setError(null);
    try {
      const savedView = await api.analytics.updateSavedView(view.id, {
        primaryMetric,
        comparisonMetric: null,
      });
      setViews((current) =>
        current.map((currentView) =>
          currentView.id === view.id ? savedView : currentView,
        ),
      );
      setReplacingId(null);
      setReplacementMetrics([]);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  const confirmDelete = (view: AnalyticsSavedView) => {
    const proceed = () => void remove(view.id);
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Delete ${view.name}?`)) proceed();
      return;
    }
    Alert.alert('Delete saved view?', view.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: proceed },
    ]);
  };
  if (error !== null)
    return <ErrorState message={error} onRetry={() => void load()} />;
  return (
    <AppScreen contentClassName="gap-2">
      <AppText variant="title">Saved Views</AppText>
      {views.map((view, index) => (
        <View key={view.id} className="border-t border-line py-4 gap-2">
          {editingId === view.id ? (
            <View className="gap-2">
              <AppInput
                label="View name"
                value={editingName}
                onChangeText={setEditingName}
                maxLength={80}
                accessibilityLabel={`Rename ${view.name}`}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Save name for ${view.name}`}
                className="min-h-11 justify-center"
                onPress={() => void rename(view.id)}
              >
                <AppText variant="caption">Save name</AppText>
              </Pressable>
            </View>
          ) : (
            <AppText variant="label" numberOfLines={2}>
              {view.name}
            </AppText>
          )}
          <AppText muted>
            {view.unavailableMetrics.length === 0
              ? `${view.periodDays}D`
              : `Needs replacement: ${view.unavailableMetrics.join(', ')}`}
          </AppText>
          {view.unavailableMetrics.length === 0 ? null : (
            <View className="gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Replace unavailable metric for ${view.name}`}
                className="min-h-11 justify-center"
                onPress={() => void beginReplacement(view)}
              >
                <AppText variant="caption">Replace metric</AppText>
              </Pressable>
              {replacingId !== view.id ? null : replacementMetrics.length ===
                0 ? (
                <AppText muted>
                  No current metric supports this saved configuration.
                </AppText>
              ) : (
                replacementMetrics.map((metric) => (
                  <Pressable
                    key={metric.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${metric.displayName}`}
                    className="min-h-11 justify-center"
                    onPress={() => void replaceMetric(view, metric.key)}
                  >
                    <AppText variant="caption">
                      Use {metric.displayName}
                    </AppText>
                  </Pressable>
                ))
              )}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${view.name}`}
            className="min-h-11 justify-center"
            disabled={trendQueryFromSavedView(view) === null}
            onPress={() => {
              const query = trendQueryFromSavedView(view);
              if (query === null) return;
              router.push({
                pathname: '/trends/[metric]',
                params: {
                  metric: query.primaryMetric,
                  query: trendQueryRouteParam(query),
                  savedViewId: view.id,
                },
              } as never);
            }}
          >
            <AppText variant="caption">Open</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Duplicate ${view.name}`}
            className="min-h-11 justify-center"
            onPress={() => void duplicate(view.id)}
          >
            <AppText variant="caption">Duplicate</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Rename ${view.name}`}
            className="min-h-11 justify-center"
            onPress={() => {
              setEditingId(view.id);
              setEditingName(view.name);
            }}
          >
            <AppText variant="caption">Rename</AppText>
          </Pressable>
          <View className="flex-row gap-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move ${view.name} earlier`}
              className="min-h-11 justify-center"
              disabled={index === 0}
              onPress={() => void reorder(view.id, -1)}
            >
              <AppText variant="caption">Move earlier</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Move ${view.name} later`}
              className="min-h-11 justify-center"
              disabled={index === views.length - 1}
              onPress={() => void reorder(view.id, 1)}
            >
              <AppText variant="caption">Move later</AppText>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              pinnedId === view.id ? `Unpin ${view.name}` : `Pin ${view.name}`
            }
            onPress={() => void togglePin(view.id)}
            className="min-h-11 justify-center"
          >
            <AppText variant="caption">
              {pinnedId === view.id ? 'Unpin' : 'Pin'}
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${view.name}`}
            className="min-h-11 justify-center"
            onPress={() => confirmDelete(view)}
          >
            <AppText variant="caption" className="text-error">
              Delete
            </AppText>
          </Pressable>
        </View>
      ))}
    </AppScreen>
  );
}

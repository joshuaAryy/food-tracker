import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  AnalyticsMetricDefinition,
  AnalyticsSavedView,
} from '@food-tracker/shared';
import { AppCard } from '@/components/app-card';
import { AppButton } from '@/components/app-button';
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
  const [actionViewId, setActionViewId] = useState<string | null>(null);
  const [deleteViewId, setDeleteViewId] = useState<string | null>(null);
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
    setActionViewId(null);
    setDeleteViewId(view.id);
  };
  const actionView = views.find((view) => view.id === actionViewId) ?? null;
  const deleteView = views.find((view) => view.id === deleteViewId) ?? null;
  const pinnedViews = useMemo(
    () => views.filter((view) => view.id === pinnedId),
    [pinnedId, views],
  );
  const otherViews = useMemo(
    () => views.filter((view) => view.id !== pinnedId),
    [pinnedId, views],
  );
  const openView = (view: AnalyticsSavedView) => {
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
  };
  const viewSubtitle = (view: AnalyticsSavedView) =>
    view.unavailableMetrics.length > 0
      ? `Needs replacement: ${view.unavailableMetrics.join(', ')}`
      : `${view.aggregation.replaceAll('_', ' ')} · ${view.visualization.replaceAll('_', ' ')}`;
  const renderView = (view: AnalyticsSavedView) => (
    <AppCard key={view.id} className="gap-3 p-4">
      <View className="flex-row items-start gap-3">
        <SavedViewDragHandle
          viewName={view.name}
          onMove={(direction) => void reorder(view.id, direction)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${view.name}`}
          className="min-w-0 flex-1 gap-1"
          onPress={() => openView(view)}
        >
          <View className="flex-row items-start gap-2">
            <View className="mt-1 h-2 w-2 rounded-full bg-primary" />
            <AppText
              variant="label"
              className="min-w-0 flex-1"
              numberOfLines={3}
            >
              {view.name}
            </AppText>
          </View>
          <AppText variant="caption" muted>
            {viewSubtitle(view)}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${view.name}`}
          className="min-h-11 min-w-11 items-center justify-center"
          onPress={() => setActionViewId(view.id)}
        >
          <AppText variant="label">•••</AppText>
        </Pressable>
      </View>
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
      ) : null}
      {view.unavailableMetrics.length === 0 ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Replace unavailable metric for ${view.name}`}
          className="min-h-11 justify-center"
          onPress={() => void beginReplacement(view)}
        >
          <AppText variant="caption">Replace metric</AppText>
        </Pressable>
      )}
      {replacingId !== view.id ? null : replacementMetrics.length === 0 ? (
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
            <AppText variant="caption">Use {metric.displayName}</AppText>
          </Pressable>
        ))
      )}
    </AppCard>
  );
  if (error !== null)
    return <ErrorState message={error} onRetry={() => void load()} />;
  if (deleteView !== null) {
    return (
      <AppScreen
        backgroundColor="#EDEDEB"
        contentClassName="mt-36 gap-5 rounded-t-[28px] bg-white pt-4"
      >
        <View className="h-1 w-[58px] self-center rounded-full bg-[#C7C7BF]" />
        <AppText variant="heading" className="text-[24px] leading-8">
          Delete saved view?
        </AppText>
        <AppText muted>
          {deleteView.name} will be removed from Saved Views. This does not
          delete nutrition or weight data.
        </AppText>
        <AppButton variant="secondary" onPress={() => setDeleteViewId(null)}>
          Cancel
        </AppButton>
        <AppButton
          onPress={() => {
            setDeleteViewId(null);
            void remove(deleteView.id);
          }}
        >
          Delete saved view
        </AppButton>
      </AppScreen>
    );
  }
  if (actionView !== null) {
    const actionIndex = views.findIndex((view) => view.id === actionView.id);
    return (
      <AppScreen
        backgroundColor="#EDEDEB"
        contentClassName="mt-24 gap-4 rounded-t-[28px] bg-white pt-4"
      >
        <View className="h-1 w-[58px] self-center rounded-full bg-[#C7C7BF]" />
        <AppText variant="heading" className="text-[21px] leading-7">
          {actionView.name}
        </AppText>
        <AppText variant="caption" muted>
          Saved view actions
        </AppText>
        <View className="overflow-hidden rounded-[16px] border border-border">
          <SheetAction
            label="Open view"
            onPress={() => {
              setActionViewId(null);
              openView(actionView);
            }}
          />
          <SheetAction
            label="Rename"
            onPress={() => {
              setActionViewId(null);
              setEditingId(actionView.id);
              setEditingName(actionView.name);
            }}
          />
          <SheetAction
            label="Duplicate"
            onPress={() => {
              setActionViewId(null);
              void duplicate(actionView.id);
            }}
          />
          <SheetAction
            label={
              pinnedId === actionView.id
                ? 'Unpin from Insights'
                : 'Pin to Insights'
            }
            onPress={() => {
              setActionViewId(null);
              void togglePin(actionView.id);
            }}
          />
          <SheetAction
            label="Move earlier"
            disabled={actionIndex === 0}
            onPress={() => {
              setActionViewId(null);
              void reorder(actionView.id, -1);
            }}
          />
          <SheetAction
            label="Move later"
            disabled={actionIndex === views.length - 1}
            onPress={() => {
              setActionViewId(null);
              void reorder(actionView.id, 1);
            }}
          />
          <SheetAction
            label="Delete saved view"
            destructive
            onPress={() => confirmDelete(actionView)}
          />
        </View>
        <AppText variant="caption" muted>
          Pinning replaces the current primary pinned view; it does not create
          another Insights card.
        </AppText>
      </AppScreen>
    );
  }
  return (
    <AppScreen contentClassName="gap-4">
      <View className="flex-row items-start justify-between gap-4">
        <View className="gap-1">
          <AppText variant="caption" muted>
            ‹ Explore trends
          </AppText>
          <AppText variant="title">Saved views</AppText>
        </View>
        <AppText variant="label">Edit</AppText>
      </View>
      <AppText variant="caption" muted>
        One primary pinned view can appear in Complex Insights. Reorder only
        affects this library.
      </AppText>
      {pinnedViews.length === 0 ? null : (
        <AppText variant="caption" className="font-bold uppercase text-muted">
          Pinned
        </AppText>
      )}
      {pinnedViews.map((view) => renderView(view))}
      {otherViews.length === 0 ? null : (
        <AppText variant="caption" className="font-bold uppercase text-muted">
          Other saved views
        </AppText>
      )}
      {otherViews.map((view) => renderView(view))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a saved view"
        className="min-h-11 items-center justify-center rounded-[16px] bg-module"
        onPress={() => router.push('/trends/save-view' as never)}
      >
        <AppText variant="label">+ Create a saved view</AppText>
      </Pressable>
      <AppText variant="caption" muted>
        Drag a handle up or down to reorder. Reordering never changes the report
        order in Insights.
      </AppText>
    </AppScreen>
  );
}

function SheetAction({
  label,
  onPress,
  disabled = false,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className="min-h-[58px] flex-row items-center justify-between border-b border-border px-4 py-3 last:border-b-0"
      disabled={disabled}
      onPress={onPress}
    >
      <AppText className={destructive ? 'text-error' : 'text-ink'}>
        {label}
      </AppText>
      {destructive ? null : <AppText variant="caption">›</AppText>}
    </Pressable>
  );
}

function SavedViewDragHandle({
  viewName,
  onMove,
}: {
  viewName: string;
  onMove: (direction: -1 | 1) => void;
}) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dy) < 24) return;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onMove(gestureState.dy < 0 ? -1 : 1);
        },
      }),
    [onMove],
  );
  return (
    <View
      testID={`saved-view-drag-handle-${viewName}`}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Reorder ${viewName}`}
      accessibilityHint="Drag up or down to change the saved-view order."
      accessibilityActions={[
        { name: 'increment', label: 'Move later' },
        { name: 'decrement', label: 'Move earlier' },
      ]}
      onAccessibilityAction={(event) => {
        onMove(event.nativeEvent.actionName === 'decrement' ? -1 : 1);
      }}
      {...panResponder.panHandlers}
      className="min-h-11 min-w-11 items-center justify-center"
    >
      <AppText muted>≡</AppText>
    </View>
  );
}

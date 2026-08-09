import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import type { AnalyticsSavedView } from '@food-tracker/shared';
import { AppScreen } from '@/components/app-screen';
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
      await load();
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
      {views.map((view) => (
        <View key={view.id} className="border-t border-line py-4 gap-2">
          <AppText variant="label">{view.name}</AppText>
          <AppText muted>
            {view.unavailableMetrics.length === 0
              ? `${view.periodDays}D`
              : `Needs replacement: ${view.unavailableMetrics.join(', ')}`}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${view.name}`}
            disabled={trendQueryFromSavedView(view) === null}
            onPress={() => {
              const query = trendQueryFromSavedView(view);
              if (query === null) return;
              router.push({
                pathname: '/trends/[metric]',
                params: {
                  metric: query.primaryMetric,
                  query: trendQueryRouteParam(query),
                },
              } as never);
            }}
          >
            <AppText variant="caption">Open</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Duplicate ${view.name}`}
            onPress={() => void duplicate(view.id)}
          >
            <AppText variant="caption">Duplicate</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              pinnedId === view.id ? `Unpin ${view.name}` : `Pin ${view.name}`
            }
            onPress={() => void togglePin(view.id)}
          >
            <AppText variant="caption">
              {pinnedId === view.id ? 'Unpin' : 'Pin'}
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${view.name}`}
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

import { useCallback, useEffect, useState } from 'react';
import type { Recommendation } from '@food-tracker/shared';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ApiClientError, apiRequest } from '@/lib/api-client';

interface RecommendationsResponse {
  recommendations: Recommendation[];
}

const severityStyle = {
  low: 'bg-amber-100 text-amber-800',
  medium: 'bg-orange-100 text-orange-800',
  high: 'bg-red-100 text-red-800',
} as const;

export default function RecommendationsScreen() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await apiRequest<RecommendationsResponse>('/recommendations/generate', {
        method: 'POST',
      });
      const result =
        await apiRequest<RecommendationsResponse>('/recommendations');
      setRecommendations(result.recommendations);
    } catch (requestError) {
      setError(
        requestError instanceof ApiClientError
          ? requestError.message
          : 'Recommendations could not be loaded.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="gap-5 px-6 py-10">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-slate-950">Insights</Text>
          <Text className="text-base leading-6 text-slate-600">
            Deterministic guidance based on your recent tracking data.
          </Text>
        </View>

        {isLoading ? (
          <View className="rounded-2xl border border-slate-200 bg-white p-5">
            <Text className="text-base text-slate-600">
              Checking your recent tracking data…
            </Text>
          </View>
        ) : null}

        {!isLoading && error !== null ? (
          <View className="gap-3 rounded-2xl border border-red-200 bg-red-50 p-5">
            <Text className="text-lg font-semibold text-red-900">
              Insights could not be loaded
            </Text>
            <Text className="text-base leading-6 text-red-800">{error}</Text>
            <Pressable
              className="self-start rounded-xl bg-red-900 px-4 py-3"
              onPress={() => void loadRecommendations()}
            >
              <Text className="font-semibold text-white">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && error === null && recommendations.length === 0 ? (
          <View className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
            <Text className="text-lg font-semibold text-slate-900">
              No active insights
            </Text>
            <Text className="mt-2 text-base leading-6 text-slate-600">
              Your recent tracking data does not currently trigger a
              recommendation.
            </Text>
          </View>
        ) : null}

        {!isLoading && error === null
          ? recommendations.map((recommendation) => (
              <View
                key={recommendation.id}
                className="gap-3 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <Text className="flex-1 text-lg font-semibold text-slate-950">
                    {recommendation.title}
                  </Text>
                  <Text
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${severityStyle[recommendation.severity]}`}
                  >
                    {recommendation.severity}
                  </Text>
                </View>
                <Text className="text-base leading-6 text-slate-700">
                  {recommendation.message}
                </Text>
              </View>
            ))
          : null}
      </View>
    </ScrollView>
  );
}

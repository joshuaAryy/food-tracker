import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  ReportingNutrientGroup,
  ReportsResponse,
} from '@food-tracker/shared';
import { AppScreen } from '@/components/app-screen';
import { ErrorState } from '@/components/error-state';
import { NutrientLibrary } from '@/components/analytics/nutrients/nutrient-library';
import { api, errorMessage } from '@/lib/api-client';

function groupFromParam(
  value: string | string[] | undefined,
): ReportingNutrientGroup | null {
  if (
    value === 'general' ||
    value === 'carbohydrate_fiber' ||
    value === 'lipids' ||
    value === 'protein_amino_acid' ||
    value === 'vitamins' ||
    value === 'minerals' ||
    value === 'other'
  ) {
    return value;
  }
  return null;
}

export default function NutrientLibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; query?: string }>();
  const [report, setReport] = useState<ReportsResponse | null>(null);
  const [mode, setMode] = useState<'simple' | 'complex' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const catalog = await api.analytics.trendCatalog();
      setMode(catalog.mode);
      if (catalog.mode === 'complex') {
        setReport(await api.analytics.reports({ period: 'month' }));
      } else {
        setReport(null);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (mode === 'simple' && error === null) {
    return (
      <AppScreen backgroundColor="#FFFFFF">
        <ErrorState
          title="Nutrient library is unavailable"
          message="Switch to Complex mode to browse detailed nutrient reports."
          onRetry={() => router.back()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      backgroundColor="#FFFFFF"
      contentClassName="gap-7 pb-8"
      onRefresh={() => void load()}
      refreshing={loading}
    >
      <NutrientLibrary
        report={report}
        category={groupFromParam(params.category)}
        initialQuery={typeof params.query === 'string' ? params.query : ''}
        loading={loading}
        error={error}
        onBack={() => router.back()}
        onRetry={() => void load()}
        onOpenMetric={(metric) =>
          router.push({
            pathname: '/trends/[metric]',
            params: { metric },
          } as never)
        }
        onOpenCategory={(category) =>
          router.push({
            pathname: '/trends/nutrients',
            params: { category },
          } as never)
        }
      />
    </AppScreen>
  );
}

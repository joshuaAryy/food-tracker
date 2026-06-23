import { useCallback, useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { AppLogo } from '@/components/app-logo';
import { AppScreen } from '@/components/app-screen';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';

export default function IndexScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const checkSetup = useCallback(async () => {
    setError(null);

    try {
      const status = await api.setup.status();
      if (status.isComplete) {
        router.replace('/(tabs)/progress');
      } else {
        router.replace('/onboarding' as Href);
      }
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, [router]);

  useEffect(() => {
    void checkSetup();
  }, [checkSetup]);

  if (error !== null) {
    return (
      <AppScreen>
        <ScreenHeader
          title="Food Tracker"
          subtitle="Connect to the API to continue."
          action={<AppLogo size={40} />}
        />
        <ErrorState
          title="Food Tracker can’t reach the API"
          message={error}
          onRetry={() => void checkSetup()}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <LoadingState message="Checking your setup…" />
    </AppScreen>
  );
}

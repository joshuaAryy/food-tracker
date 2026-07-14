import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import type { TrackingMode } from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { PhotoFoodReviewRow } from '@/components/photo-food-review-row';
import { ScreenHeader } from '@/components/screen-header';
import {
  ApiClientError,
  api,
  errorMessage,
  PHOTO_ANALYSIS_CLIENT_TIMEOUT_MS,
} from '@/lib/api-client';
import { cleanupPhotoFiles } from '@/lib/photo-image';
import {
  confirmPhotoRow,
  photoRowReason,
  photoRowsDisposition,
  photoRowsFromAnalysis,
  type PhotoReviewRow,
} from '@/lib/photo-log-ui';
import { useAppStore } from '@/store/app-store';

type AnalysisState = 'ready' | 'analyzing' | 'recognized' | 'no_food' | 'error';

async function cleanupSession(
  session: NonNullable<
    ReturnType<typeof useAppStore.getState>['photoLogSession']
  >,
) {
  await cleanupPhotoFiles([
    { uri: session.normalizedUri, ownership: 'app_normalized' },
    { uri: session.originalUri, ownership: session.originalOwnership },
  ]);
}

export default function PhotoLogReviewScreen() {
  const router = useRouter();
  const session = useAppStore((state) => state.photoLogSession);
  const setRows = useAppStore((state) => state.setPhotoLogRows);
  const clearSession = useAppStore((state) => state.clearPhotoLogSession);
  const [mode, setMode] = useState<TrackingMode>('simple');
  const [analysisState, setAnalysisState] = useState<AnalysisState>('ready');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const controllerRef = useRef<AbortController | null>(null);
  const preserveOnUnmount = useRef(false);

  useEffect(() => {
    if (session === null) {
      router.replace('/photo-log' as Href);
      return;
    }
    let active = true;
    void api.trackingPreferences
      .get()
      .then((preferences) => {
        if (active) setMode(preferences.mode);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      controllerRef.current?.abort();
      if (
        !preserveOnUnmount.current &&
        useAppStore.getState().photoLogSession?.sessionId === session.sessionId
      ) {
        void cleanupSession(session).finally(() =>
          useAppStore.getState().clearPhotoLogSession(),
        );
      }
    };
  }, [router, session?.sessionId]);

  if (session === null) return null;

  const rows = session.rows;
  const disposition = photoRowsDisposition(rows);

  const startAnalysis = async () => {
    if (analysisState === 'analyzing') return;
    const requestSessionId = session.sessionId;
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = setTimeout(
      () => controller.abort(),
      PHOTO_ANALYSIS_CLIENT_TIMEOUT_MS,
    );
    setAnalysisState('analyzing');
    setAnalysisError(null);
    setRowErrors({});
    try {
      const result = await api.ai.analyzePhoto(
        {
          uri: session.normalizedUri,
          mimeType: session.normalizedMimeType,
          byteSize: session.normalizedByteSize,
        },
        controller.signal,
      );
      if (
        useAppStore.getState().photoLogSession?.sessionId !== requestSessionId
      )
        return;
      if (session.originalOwnership === 'app_capture') {
        await cleanupPhotoFiles([
          { uri: session.originalUri, ownership: 'app_capture' },
        ]);
      }
      const nextRows = photoRowsFromAnalysis(result);
      setRows(nextRows);
      setAnalysisState(
        result.status === 'no_food_detected' ? 'no_food' : 'recognized',
      );
    } catch (cause) {
      if (
        useAppStore.getState().photoLogSession?.sessionId !== requestSessionId
      )
        return;
      if (cause instanceof ApiClientError && cause.code === 'CANCELLED') {
        if (session.originalOwnership === 'app_capture') {
          await cleanupPhotoFiles([
            { uri: session.originalUri, ownership: 'app_capture' },
          ]);
        }
        setAnalysisState('ready');
        setAnalysisError(
          'Analysis cancelled. You can try again with this photo.',
        );
      } else {
        if (session.originalOwnership === 'app_capture') {
          await cleanupPhotoFiles([
            { uri: session.originalUri, ownership: 'app_capture' },
          ]);
        }
        setAnalysisState('error');
        setAnalysisError(
          errorMessage(
            cause,
            'Photo analysis is unavailable right now. Try again.',
          ),
        );
      }
    } finally {
      clearTimeout(timeout);
      controllerRef.current = null;
    }
  };

  const cancelAnalysis = () => controllerRef.current?.abort();
  const closeFlow = async () => {
    preserveOnUnmount.current = true;
    await cleanupSession(session);
    clearSession();
    router.dismissAll();
  };
  const retake = async () => {
    preserveOnUnmount.current = true;
    await cleanupSession(session);
    clearSession();
    router.replace('/photo-log' as Href);
  };
  const updateRow = (next: PhotoReviewRow) => {
    setRows(rows.map((row) => (row.id === next.id ? next : row)));
  };
  const confirmRow = (row: PhotoReviewRow) => {
    const next = confirmPhotoRow(row);
    const reason = next.status === 'confirmed' ? null : photoRowReason(next);
    if (reason !== null)
      setRowErrors((current) => ({ ...current, [row.id]: reason }));
    else setRowErrors((current) => ({ ...current, [row.id]: '' }));
    updateRow(next);
  };
  const continueToConfirm = () => {
    const nextDisposition = photoRowsDisposition(
      useAppStore.getState().photoLogSession?.rows ?? [],
    );
    if (!nextDisposition.canContinue) {
      setRowErrors(nextDisposition.blockedReasons);
      return;
    }
    preserveOnUnmount.current = true;
    router.push('/photo-log/confirm' as Href);
  };

  return (
    <AppScreen
      contentClassName="gap-5"
      footer={
        <View className="gap-2">
          <AppButton
            disabled={analysisState === 'analyzing' || !disposition.canContinue}
            onPress={continueToConfirm}
          >
            Continue to confirmation
          </AppButton>
          <AppButton
            variant="secondary"
            disabled={analysisState === 'analyzing'}
            onPress={() => void closeFlow()}
          >
            Cancel photo log
          </AppButton>
        </View>
      }
    >
      <ScreenHeader
        eyebrow="Photo logging"
        title="Review the photo"
        subtitle="Every row is provisional. Confirm trusted food and serving details before saving."
        action={
          <Pressable
            disabled={analysisState === 'analyzing'}
            onPress={() => void closeFlow()}
          >
            <AppText variant="label">Close</AppText>
          </Pressable>
        }
      />
      <View className="overflow-hidden rounded-[26px] bg-ink">
        <Image
          source={{ uri: session.normalizedUri }}
          resizeMode="contain"
          style={{ width: '100%', height: 230 }}
        />
      </View>
      <View className="flex-row gap-2">
        <AppButton
          variant="secondary"
          disabled={analysisState === 'analyzing'}
          onPress={() => void retake()}
        >
          Retake or replace
        </AppButton>
        {analysisState === 'ready' || analysisState === 'error' ? (
          <AppButton onPress={() => void startAnalysis()}>
            Analyze photo
          </AppButton>
        ) : null}
      </View>
      {analysisState === 'analyzing' ? (
        <View className="flex-row items-center gap-3 rounded-control bg-primary-soft px-3 py-3">
          <ActivityIndicator />
          <View className="flex-1">
            <AppText variant="label">Analyzing photo</AppText>
            <AppText variant="caption" muted>
              Identifying foods and finding trusted matches. This may take up to
              15 seconds.
            </AppText>
          </View>
          <Pressable onPress={cancelAnalysis}>
            <AppText variant="label">Cancel</AppText>
          </Pressable>
        </View>
      ) : null}
      {analysisError === null ? null : (
        <ErrorState
          title="Photo analysis needs another try"
          message={analysisError}
          onRetry={() => void startAnalysis()}
        />
      )}
      {analysisState === 'no_food' ? (
        <View className="gap-2 rounded-control bg-error-soft px-3 py-3">
          <AppText variant="label" className="text-error">
            No food detected
          </AppText>
          <AppText variant="caption" className="text-error">
            Try a clearer plate photo or add foods manually.
          </AppText>
          <AppButton
            variant="secondary"
            onPress={() => router.push('/photo-log/search?context=add' as Href)}
          >
            Add trusted food
          </AppButton>
        </View>
      ) : null}
      {analysisState === 'recognized' && rows.length === 0 ? (
        <AppText variant="caption" muted>
          No review rows were returned.
        </AppText>
      ) : null}
      {rows.map((row) => (
        <PhotoFoodReviewRow
          key={row.id}
          row={row}
          mode={mode}
          error={rowErrors[row.id] || undefined}
          onChange={updateRow}
          onReplace={() => {
            preserveOnUnmount.current = true;
            router.push(
              `/photo-log/search?context=replace&rowId=${encodeURIComponent(row.id)}` as Href,
            );
          }}
          onToggleInclude={() =>
            updateRow({
              ...row,
              status: row.status === 'excluded' ? 'pending' : 'excluded',
            })
          }
          onConfirm={() => confirmRow(row)}
        />
      ))}
      {rows.length > 0 ? (
        <AppButton
          variant="secondary"
          onPress={() => {
            preserveOnUnmount.current = true;
            router.push('/photo-log/search?context=add' as Href);
          }}
        >
          Add a missed food
        </AppButton>
      ) : null}
    </AppScreen>
  );
}

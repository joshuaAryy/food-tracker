import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, type Href } from 'expo-router';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import {
  cleanupPhotoFiles,
  normalizePhotoImage,
  PhotoImageError,
} from '@/lib/photo-image';
import { ensurePhotoLibraryPermission } from '@/lib/photo-log-ui';
import { safePhotoLogBack } from '@/lib/photo-log-navigation';
import { useAppStore } from '@/store/app-store';

function sessionId(): string {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PhotoLogSourceScreen() {
  const router = useRouter();
  const beginSession = useAppStore((state) => state.beginPhotoLogSession);
  const existingSession = useAppStore((state) => state.photoLogSession);
  const clearSession = useAppStore((state) => state.clearPhotoLogSession);
  const [working, setWorking] = useState<'camera' | 'library' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<
    'denied' | 'settings' | null
  >(null);
  const activeRef = useRef(true);
  const pickerRequestRef = useRef(0);

  useEffect(
    () => () => {
      activeRef.current = false;
    },
    [],
  );

  const openCamera = () => {
    setError(null);
    router.push('/photo-log/camera' as Href);
  };

  const close = async () => {
    pickerRequestRef.current += 1;
    if (existingSession !== null) {
      await cleanupPhotoFiles([
        { uri: existingSession.normalizedUri, ownership: 'app_normalized' },
        {
          uri: existingSession.originalUri,
          ownership: existingSession.originalOwnership,
        },
      ]);
      clearSession();
    }
    safePhotoLogBack({
      canGoBack: router.canGoBack,
      back: router.back,
      replace: router.replace,
      fallback: '/(tabs)/history' as Href,
    });
  };

  const chooseLibrary = async () => {
    if (working !== null) return;
    const pickerRequestId = pickerRequestRef.current + 1;
    pickerRequestRef.current = pickerRequestId;
    setWorking('library');
    setError(null);
    setPermissionState(null);
    try {
      const permissionDecision = await ensurePhotoLibraryPermission({
        get: (writeOnly) =>
          ImagePicker.getMediaLibraryPermissionsAsync(writeOnly),
        request: (writeOnly) =>
          ImagePicker.requestMediaLibraryPermissionsAsync(writeOnly),
      });
      if (permissionDecision.status !== 'granted') {
        if (activeRef.current && pickerRequestRef.current === pickerRequestId) {
          setPermissionState(
            permissionDecision.canAskAgain ? 'denied' : 'settings',
          );
          setError(
            permissionDecision.canAskAgain
              ? 'Photo-library access is needed to choose a food photo.'
              : 'Photo-library access is off. Open Settings to allow Food Tracker to choose a food photo.',
          );
        }
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: false,
        base64: false,
        exif: false,
      });
      if (result.canceled || result.assets.length === 0) return;
      if (!activeRef.current || pickerRequestRef.current !== pickerRequestId) {
        return;
      }
      const asset = result.assets[0];
      if (asset === undefined) return;
      if (__DEV__) {
        console.warn('[photo-debug] library asset returned', {
          uriScheme: asset.uri.split(':', 1)[0] ?? 'unknown',
          fileExtension: asset.uri.split('.').pop()?.toLowerCase() ?? 'unknown',
          mimeType: asset.mimeType ?? 'unknown',
          width: asset.width,
          height: asset.height,
        });
      }
      const normalized = await normalizePhotoImage({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        orientation:
          typeof asset.exif?.Orientation === 'number'
            ? asset.exif.Orientation
            : null,
      });
      if (__DEV__) {
        console.warn('[photo-debug] library normalization complete', {
          uriScheme: normalized.uri.split(':', 1)[0] ?? 'unknown',
          fileExists: true,
          normalizedByteSize: normalized.byteSize,
          normalizedMimeType: normalized.mimeType,
          width: normalized.width,
          height: normalized.height,
        });
      }
      if (!activeRef.current || pickerRequestRef.current !== pickerRequestId) {
        await cleanupPhotoFiles([
          { uri: normalized.uri, ownership: 'app_normalized' },
        ]);
        return;
      }
      if (existingSession !== null) {
        await cleanupPhotoFiles([
          { uri: existingSession.normalizedUri, ownership: 'app_normalized' },
          {
            uri: existingSession.originalUri,
            ownership: existingSession.originalOwnership,
          },
        ]);
      }
      beginSession({
        sessionId: sessionId(),
        source: 'library',
        originalUri: asset.uri,
        originalOwnership: 'user_library',
        normalizedUri: normalized.uri,
        normalizedWidth: normalized.width,
        normalizedHeight: normalized.height,
        normalizedByteSize: normalized.byteSize,
        normalizedMimeType: normalized.mimeType,
        rows: [],
      });
      router.push('/photo-log/review' as Href);
    } catch (cause) {
      if (activeRef.current && pickerRequestRef.current === pickerRequestId) {
        setError(
          cause instanceof PhotoImageError
            ? cause.message
            : 'The photo could not be prepared. Try choosing another image.',
        );
      }
    } finally {
      if (activeRef.current && pickerRequestRef.current === pickerRequestId) {
        setWorking(null);
      }
    }
  };

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      setError('Settings could not be opened. Enable photo access manually.');
    }
  };

  return (
    <AppScreen
      contentClassName="gap-5"
      footer={
        <AppButton variant="secondary" onPress={() => void close()}>
          Cancel
        </AppButton>
      }
    >
      <ScreenHeader
        eyebrow="Food Log"
        title="Photo logging"
        subtitle="Choose a photo, review every food, then confirm what to save."
        action={
          <Pressable onPress={() => void close()}>
            <AppText variant="label">Close</AppText>
          </Pressable>
        }
      />
      <View className="gap-3 rounded-[26px] bg-primary-soft px-4 py-4">
        <AppText variant="label">One-time analysis</AppText>
        <AppText variant="caption" muted>
          The normalized JPEG is sent to the configured AI provider for
          analysis. Food Tracker does not retain the photo, and analysis never
          creates a food log automatically.
        </AppText>
      </View>
      {error === null ? null : (
        <ErrorState
          title="Photo source unavailable"
          message={error}
          onRetry={
            permissionState === 'settings'
              ? () => void openSettings()
              : undefined
          }
          retryLabel={
            permissionState === 'settings' ? 'Open Settings' : undefined
          }
        />
      )}
      <View className="gap-3">
        <AppButton
          loading={working === 'camera'}
          disabled={working !== null}
          onPress={openCamera}
        >
          Take photo
        </AppButton>
        <AppButton
          variant="secondary"
          loading={working === 'library'}
          disabled={working !== null}
          onPress={() => void chooseLibrary()}
        >
          Choose from library
        </AppButton>
      </View>
      {permissionState === 'denied' ? (
        <AppText variant="caption" className="text-muted">
          Photo-library permission was not granted. Try again to show the
          permission prompt.
        </AppText>
      ) : null}
      <View className="flex-row items-center justify-center gap-3 py-3">
        <Camera color="#0F110E" size={20} />
        <ImageIcon color="#0F110E" size={20} />
        <AppText variant="caption" muted>
          JPEG normalization · max 2048 px · 5 MiB upload limit
        </AppText>
      </View>
    </AppScreen>
  );
}

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, type Href } from 'expo-router';
import { Camera, X } from 'lucide-react-native';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import {
  cleanupPhotoFiles,
  normalizePhotoImage,
  PhotoImageError,
} from '@/lib/photo-image';
import { useAppStore } from '@/store/app-store';

function sessionId(): string {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PhotoLogCameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const existingSession = useAppStore((state) => state.photoLogSession);
  const beginSession = useAppStore((state) => state.beginPhotoLogSession);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const activeRef = useRef(true);

  useEffect(
    () => () => {
      activeRef.current = false;
    },
    [],
  );

  useEffect(() => {
    if (!permission?.granted) {
      setCameraReady(false);
      return;
    }
    const frame = requestAnimationFrame(() => setCameraReady(true));
    return () => cancelAnimationFrame(frame);
  }, [permission?.granted]);

  const allowCamera = async () => {
    if (requesting) return;
    setRequesting(true);
    setCameraError(null);
    try {
      await requestPermission();
    } catch {
      setCameraError('Camera permission could not be updated.');
    } finally {
      setRequesting(false);
    }
  };

  const capture = async () => {
    if (capturing || cameraRef.current === null) return;
    setCapturing(true);
    setCameraError(null);
    let captureUri: string | null = null;
    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 1,
        exif: true,
      });
      if (result !== undefined) captureUri = result.uri;
      if (!activeRef.current) {
        if (captureUri !== null) {
          await cleanupPhotoFiles([
            { uri: captureUri, ownership: 'app_capture' },
          ]);
        }
        return;
      }
      if (
        result === undefined ||
        result.width === undefined ||
        result.height === undefined
      ) {
        throw new PhotoImageError(
          'The camera did not return a usable image.',
          'NORMALIZATION_FAILED',
        );
      }
      const normalized = await normalizePhotoImage({
        uri: result.uri,
        width: result.width,
        height: result.height,
        orientation:
          typeof result.exif?.Orientation === 'number'
            ? result.exif.Orientation
            : null,
      });
      if (!activeRef.current) {
        await cleanupPhotoFiles([
          { uri: result.uri, ownership: 'app_capture' },
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
        source: 'camera',
        originalUri: result.uri,
        originalOwnership: 'app_capture',
        normalizedUri: normalized.uri,
        normalizedWidth: normalized.width,
        normalizedHeight: normalized.height,
        normalizedByteSize: normalized.byteSize,
        normalizedMimeType: normalized.mimeType,
        rows: [],
      });
      router.push('/photo-log/review' as Href);
    } catch (cause) {
      if (captureUri !== null) {
        await cleanupPhotoFiles([
          { uri: captureUri, ownership: 'app_capture' },
        ]);
      }
      setCameraError(
        cause instanceof PhotoImageError
          ? cause.message
          : 'The photo could not be captured. Try again.',
      );
    } finally {
      setCapturing(false);
    }
  };

  if (permission === null) {
    return (
      <AppScreen
        scroll={false}
        contentClassName="flex-1 justify-center"
        footer={<AppButton onPress={() => router.back()}>Cancel</AppButton>}
      >
        <View className="items-center gap-3">
          <ActivityIndicator />
          <AppText variant="label">Preparing camera</AppText>
        </View>
      </AppScreen>
    );
  }
  if (!permission.granted) {
    return (
      <AppScreen
        scroll={false}
        contentClassName="flex-1 justify-center"
        footer={
          <View className="gap-2">
            <AppButton loading={requesting} onPress={() => void allowCamera()}>
              Allow camera
            </AppButton>
            <AppButton variant="secondary" onPress={() => router.back()}>
              Cancel
            </AppButton>
          </View>
        }
      >
        <View className="items-center gap-3">
          <Camera color="#0F110E" size={30} />
          <AppText variant="heading">Camera access</AppText>
          <AppText variant="body" className="text-center text-muted">
            Allow camera access to take a one-time food photo. Food Tracker does
            not retain it.
          </AppText>
        </View>
      </AppScreen>
    );
  }
  if (!cameraReady) {
    return (
      <AppScreen
        scroll={false}
        contentClassName="flex-1 justify-center"
        footer={<AppButton onPress={() => router.back()}>Cancel</AppButton>}
      >
        <View className="items-center gap-3">
          <ActivityIndicator />
          <AppText variant="label">Starting camera</AppText>
        </View>
      </AppScreen>
    );
  }
  if (cameraError !== null) {
    return (
      <AppScreen
        scroll={false}
        contentClassName="flex-1 justify-center"
        footer={
          <View className="gap-2">
            <AppButton
              onPress={() => {
                setCameraError(null);
                setCameraReady(false);
                requestAnimationFrame(() => setCameraReady(true));
              }}
            >
              Try again
            </AppButton>
            <AppButton variant="secondary" onPress={() => router.back()}>
              Cancel
            </AppButton>
          </View>
        }
      >
        <ErrorState title="Camera unavailable" message={cameraError} />
      </AppScreen>
    );
  }
  return (
    <View className="flex-1 bg-ink">
      <CameraView
        ref={cameraRef}
        facing="back"
        onMountError={() => setCameraError('Camera is unavailable right now.')}
        style={StyleSheet.absoluteFill}
      />
      <View className="absolute inset-x-0 top-0 flex-row items-center justify-between px-5 pt-16">
        <View>
          <AppText variant="heading" className="text-white">
            Take a food photo
          </AppText>
          <AppText variant="caption" className="text-white/75">
            Keep the full plate visible.
          </AppText>
        </View>
        <Pressable
          accessibilityLabel="Cancel photo capture"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-full bg-white/15"
          onPress={() => router.back()}
        >
          <X color="#FFFFFF" size={21} />
        </Pressable>
      </View>
      <View className="absolute inset-x-5 bottom-10">
        <AppButton
          loading={capturing}
          disabled={capturing}
          onPress={() => void capture()}
        >
          Capture photo
        </AppButton>
      </View>
    </View>
  );
}

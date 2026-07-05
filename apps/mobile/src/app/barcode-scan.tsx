import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
  type BarcodeType,
} from 'expo-camera';
import { useRouter } from 'expo-router';
import { Camera, RotateCcw, X } from 'lucide-react-native';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { api, ApiClientError, errorMessage } from '@/lib/api-client';
import { colors } from '@/theme/tokens';

const PACKAGED_FOOD_BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
];

type ScannerState = 'scanning' | 'lookingUp' | 'noMatch' | 'error';

export default function BarcodeScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerState, setScannerState] = useState<ScannerState>('scanning');
  const [message, setMessage] = useState<string | null>(null);
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);

  const close = () => {
    router.back();
  };

  const retry = () => {
    setScannerState('scanning');
    setMessage(null);
    setLastBarcode(null);
  };

  const openManualEntry = () => {
    router.replace('/food-log');
  };

  const lookupBarcode = async (barcode: string) => {
    setScannerState('lookingUp');
    setMessage(null);
    setLastBarcode(barcode);

    try {
      const foodItem = await api.foodItems.lookupBarcodeWithExternal({
        barcode,
      });
      router.replace({
        pathname: '/food-log',
        params: { scannedFoodItemId: foodItem.id },
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'NOT_FOUND') {
        setScannerState('noMatch');
        setMessage(null);
        return;
      }

      setScannerState('error');
      setMessage(errorMessage(error));
    }
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    const barcode = result.data.trim();
    if (scannerState !== 'scanning' || barcode === '') {
      return;
    }

    void lookupBarcode(barcode);
  };

  if (permission === null) {
    return (
      <AppScreen
        scroll={false}
        contentClassName="flex-1 justify-center"
        footer={<AppButton onPress={close}>Cancel</AppButton>}
      >
        <View className="items-center gap-3">
          <ActivityIndicator color={colors.light.primaryDark} />
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
            <AppButton onPress={() => void requestPermission()}>
              Allow camera
            </AppButton>
            <AppButton variant="secondary" onPress={close}>
              Cancel
            </AppButton>
          </View>
        }
      >
        <View className="items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
            <Camera color={colors.light.ink} size={24} strokeWidth={2.3} />
          </View>
          <View className="items-center gap-1">
            <AppText variant="heading">Scan barcode</AppText>
            <AppText
              variant="body"
              className="max-w-[280px] text-center text-muted"
            >
              Allow camera access to scan packaged foods faster.
            </AppText>
          </View>
        </View>
      </AppScreen>
    );
  }

  return (
    <View className="flex-1 bg-ink">
      <CameraView
        active={scannerState === 'scanning'}
        barcodeScannerSettings={{
          barcodeTypes: PACKAGED_FOOD_BARCODE_TYPES,
        }}
        className="flex-1"
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        onMountError={() => {
          setScannerState('error');
          setMessage('Camera is unavailable right now.');
        }}
      />

      <View className="absolute inset-x-0 top-0 px-5 pt-16">
        <View className="flex-row items-center justify-between">
          <View>
            <AppText variant="heading" className="text-white">
              Scan barcode
            </AppText>
            <AppText variant="caption" className="text-white/75">
              Hold the barcode inside the frame.
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Cancel barcode scan"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center rounded-full bg-white/15"
            onPress={close}
          >
            <X color="#FFFFFF" size={21} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>

      <View className="absolute inset-x-10 top-[34%] h-[150px] rounded-[28px] border-2 border-white/85" />

      <View className="absolute inset-x-5 bottom-10 gap-3 rounded-[28px] bg-white p-4">
        {scannerState === 'lookingUp' ? (
          <View className="flex-row items-center gap-3">
            <ActivityIndicator color={colors.light.primaryDark} />
            <View className="min-w-0 flex-1">
              <AppText variant="label">Checking barcode</AppText>
              <AppText variant="caption" muted numberOfLines={1}>
                {lastBarcode}
              </AppText>
            </View>
          </View>
        ) : scannerState === 'noMatch' ? (
          <View className="gap-3">
            <View className="gap-1">
              <AppText variant="label">No barcode match yet</AppText>
              <AppText variant="caption" muted>
                You can still save this as a reusable food.
              </AppText>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                accessibilityLabel="Scan another barcode"
                accessibilityRole="button"
                className="h-11 w-11 items-center justify-center rounded-full bg-primary-soft"
                onPress={retry}
              >
                <RotateCcw
                  color={colors.light.ink}
                  size={18}
                  strokeWidth={2.3}
                />
              </Pressable>
              <View className="flex-1">
                <AppButton onPress={openManualEntry}>Enter manually</AppButton>
              </View>
            </View>
          </View>
        ) : scannerState === 'error' ? (
          <View className="gap-3">
            <ErrorState
              title="Scanner is unavailable"
              message={message ?? 'Try again or enter the food manually.'}
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <AppButton variant="secondary" onPress={retry}>
                  Try again
                </AppButton>
              </View>
              <View className="flex-1">
                <AppButton onPress={openManualEntry}>Enter manually</AppButton>
              </View>
            </View>
          </View>
        ) : (
          <View className="gap-1">
            <AppText variant="label">Ready to scan</AppText>
            <AppText variant="caption" muted>
              Packaged foods with UPC or EAN barcodes work best.
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}

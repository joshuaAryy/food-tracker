import { Image, View } from 'react-native';
import complexLogo from '@/assets/brand/mode-icon-complex-open.png';
import simpleLogo from '@/assets/brand/mode-icon-simple-closed.png';

interface AppLogoProps {
  size?: number;
  mode?: 'simple' | 'complex';
  tone?: 'default' | 'onboarding';
}

export function AppLogo({
  size = 42,
  mode = 'simple',
  tone = 'default',
}: AppLogoProps) {
  const isComplex = mode === 'complex';
  const backgroundClass =
    tone === 'onboarding' ? 'bg-onboarding-surface' : 'bg-module';
  const imageSize = size * 0.72;

  return (
    <View
      accessibilityLabel="Food Tracker"
      className={`items-center justify-center overflow-hidden rounded-full ${backgroundClass}`}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={isComplex ? complexLogo : simpleLogo}
        style={{
          borderRadius: imageSize / 2,
          height: imageSize,
          width: imageSize,
        }}
      />
    </View>
  );
}

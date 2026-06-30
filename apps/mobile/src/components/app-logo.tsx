import { View } from 'react-native';

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
  const innerSurface =
    tone === 'onboarding' ? 'bg-onboarding-canvas' : 'bg-surface-raised';

  return (
    <View
      accessibilityLabel="Food Tracker"
      className={`items-center justify-center rounded-full border-[3px] ${
        isComplex ? 'border-ink' : 'border-primary-dark'
      }`}
      style={{ width: size, height: size }}
    >
      <View
        className={`absolute rounded-full ${innerSurface}`}
        style={{
          width: size * 0.58,
          height: size * 0.58,
          right: size * 0.04,
          top: size * 0.08,
        }}
      />
      <View
        className={`rounded-full ${isComplex ? 'bg-ink' : 'bg-primary-dark'}`}
        style={{ width: size * 0.16, height: size * 0.16 }}
      />
    </View>
  );
}

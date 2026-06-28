import { View } from 'react-native';

interface AppLogoProps {
  size?: number;
  mode?: 'simple' | 'complex';
}

export function AppLogo({ size = 42, mode = 'simple' }: AppLogoProps) {
  const isComplex = mode === 'complex';

  return (
    <View
      accessibilityLabel="Food Tracker"
      className={`items-center justify-center rounded-full border-[3px] ${
        isComplex ? 'border-ink' : 'border-primary'
      }`}
      style={{ width: size, height: size }}
    >
      <View
        className="absolute rounded-full bg-surface-raised"
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

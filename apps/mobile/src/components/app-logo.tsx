import { View } from 'react-native';

interface AppLogoProps {
  size?: number;
}

export function AppLogo({ size = 42 }: AppLogoProps) {
  return (
    <View
      accessibilityLabel="Food Tracker"
      className="items-center justify-center rounded-full border-[3px] border-sage"
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
        className="rounded-full bg-sage-dark"
        style={{ width: size * 0.16, height: size * 0.16 }}
      />
    </View>
  );
}

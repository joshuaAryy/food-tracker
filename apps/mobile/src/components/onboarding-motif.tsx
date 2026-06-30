import { View } from 'react-native';

export function OnboardingMotif() {
  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 top-[96px] h-px bg-onboarding-line opacity-60"
    />
  );
}

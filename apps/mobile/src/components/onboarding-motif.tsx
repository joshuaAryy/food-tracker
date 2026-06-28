import { View } from 'react-native';

export function OnboardingMotif() {
  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 top-[118px] h-[260px] overflow-hidden opacity-45"
    >
      <View className="absolute -right-20 top-0 h-40 w-40 rounded-full border border-onboarding-line" />
      <View className="absolute -right-10 top-10 h-28 w-28 rounded-full border border-onboarding-line" />
      <View className="absolute -left-16 bottom-2 h-32 w-32 rounded-full border border-onboarding-line" />
    </View>
  );
}

import { View } from 'react-native';
import { AppText } from './app-text';

interface OnboardingQuestionProps {
  title: string;
  subtitle?: string | undefined;
}

export function OnboardingQuestion({
  title,
  subtitle,
}: OnboardingQuestionProps) {
  return (
    <View className="items-center gap-3">
      <AppText
        variant="title"
        className="max-w-[360px] text-center text-onboarding-text text-[34px] leading-[39px]"
      >
        {title}
      </AppText>
      {subtitle === undefined ? null : (
        <AppText className="max-w-[330px] text-center text-onboarding-muted text-[17px] leading-6">
          {subtitle}
        </AppText>
      )}
    </View>
  );
}

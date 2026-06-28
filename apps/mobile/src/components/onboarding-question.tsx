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
    <View className="gap-3">
      <AppText
        variant="title"
        className="text-onboarding-text text-[29px] leading-[34px]"
      >
        {title}
      </AppText>
      {subtitle === undefined ? null : (
        <AppText className="mt-3 text-onboarding-muted leading-6">
          {subtitle}
        </AppText>
      )}
    </View>
  );
}

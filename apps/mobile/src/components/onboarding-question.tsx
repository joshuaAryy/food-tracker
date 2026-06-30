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
    <View className="gap-2">
      <AppText
        variant="title"
        className="text-onboarding-text text-[31px] leading-[36px]"
      >
        {title}
      </AppText>
      {subtitle === undefined ? null : (
        <AppText className="max-w-[360px] text-onboarding-muted leading-6">
          {subtitle}
        </AppText>
      )}
    </View>
  );
}

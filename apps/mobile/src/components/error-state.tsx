import { View } from 'react-native';
import { AppButton } from './app-button';
import { AppText } from './app-text';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: (() => void) | undefined;
}

export function ErrorState({
  title = 'Unable to load this section',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <View className="gap-3 rounded-app border border-error/30 bg-error-soft p-4">
      <View className="gap-1">
        <AppText variant="label" className="text-ink">
          {title}
        </AppText>
        <AppText variant="label" className="font-normal text-error">
          {message}
        </AppText>
      </View>
      {onRetry === undefined ? null : (
        <AppButton
          variant="secondary"
          className="self-start px-4"
          onPress={onRetry}
        >
          Try again
        </AppButton>
      )}
    </View>
  );
}

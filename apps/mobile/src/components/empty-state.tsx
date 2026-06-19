import { View } from 'react-native';
import { AppText } from './app-text';

interface EmptyStateProps {
  title: string;
  message: string;
  symbol?: string;
}

export function EmptyState({ title, message, symbol = '○' }: EmptyStateProps) {
  return (
    <View className="items-center gap-2.5 rounded-app border border-dashed border-border bg-surface/70 px-5 py-7">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-sage-soft">
        <AppText variant="label" className="text-sage-dark">
          {symbol}
        </AppText>
      </View>
      <View className="items-center gap-1">
        <AppText variant="heading" className="text-center">
          {title}
        </AppText>
        <AppText muted className="text-center">
          {message}
        </AppText>
      </View>
    </View>
  );
}

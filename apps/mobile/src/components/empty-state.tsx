import { View } from 'react-native';
import { AppText } from './app-text';

interface EmptyStateProps {
  title: string;
  message: string;
  symbol?: string;
}

export function EmptyState({ title, message, symbol = '○' }: EmptyStateProps) {
  return (
    <View className="items-center gap-3 rounded-[28px] bg-module-muted px-5 py-7">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-module">
        <AppText variant="label" className="text-ink">
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

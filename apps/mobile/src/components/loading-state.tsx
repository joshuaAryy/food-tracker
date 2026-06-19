import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { AppText } from './app-text';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({
  message = 'Loading your nutrition data…',
}: LoadingStateProps) {
  return (
    <View className="min-h-48 items-center justify-center gap-3">
      <ActivityIndicator color={colors.light.primaryDark} />
      <AppText muted>{message}</AppText>
    </View>
  );
}

import { View } from 'react-native';
import { AppText } from '@/components/app-text';

export function LoggingDayStateLegend() {
  return (
    <View className="flex-row flex-wrap gap-4">
      <AppText className="text-[#00B86B]">Complete</AppText>
      <AppText className="text-[#6B7280]">Partial</AppText>
      <AppText className="text-muted">Unlogged</AppText>
    </View>
  );
}

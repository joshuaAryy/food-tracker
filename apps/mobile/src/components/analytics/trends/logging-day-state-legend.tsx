import { View } from 'react-native';
import { AppText } from '@/components/app-text';

export function LoggingDayStateLegend() {
  return (
    <View className="flex-row flex-wrap gap-4">
      <AppText className="text-[#00D66B]">Complete</AppText>
      <AppText className="text-[#76DBA0]">Partial</AppText>
      <AppText className="text-muted">Unlogged</AppText>
    </View>
  );
}

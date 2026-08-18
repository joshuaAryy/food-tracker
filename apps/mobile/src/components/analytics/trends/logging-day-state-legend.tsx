import { View } from 'react-native';
import { AppText } from '@/components/app-text';

export function LoggingDayStateLegend({
  showOutsideRange = false,
}: {
  showOutsideRange?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap gap-4">
      <AppText style={{ color: '#00D66B' }}>Complete</AppText>
      <AppText style={{ color: '#76DBA0' }}>Partial</AppText>
      <AppText style={{ color: '#8A8A84' }}>Unlogged</AppText>
      {showOutsideRange ? (
        <View className="flex-row items-center gap-1">
          <View
            accessible={false}
            className="h-3 w-3 rounded-[3px]"
            style={{
              backgroundColor: '#F7F7F3',
              borderColor: '#E6E6DF',
              borderWidth: 1,
            }}
          />
          <AppText style={{ color: '#8A8A84' }}>Outside range</AppText>
        </View>
      ) : null}
    </View>
  );
}

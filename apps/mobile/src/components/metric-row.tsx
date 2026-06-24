import { View } from 'react-native';
import { AppText } from './app-text';

interface MetricRowProps {
  label: string;
  value: string;
  accentClassName?: string | undefined;
  divided?: boolean;
}

export function MetricRow({
  label,
  value,
  accentClassName,
  divided = false,
}: MetricRowProps) {
  return (
    <View className={divided ? 'border-t border-border' : ''}>
      <View className="flex-row items-center justify-between gap-4 py-2.5">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          {accentClassName === undefined ? null : (
            <View className={`h-2.5 w-2.5 rounded-full ${accentClassName}`} />
          )}
          <AppText>{label}</AppText>
        </View>
        <AppText variant="label" className="tabular-nums">
          {value}
        </AppText>
      </View>
    </View>
  );
}

import { View } from 'react-native';
import { AppText } from './app-text';

interface SummaryRowProps {
  label: string;
  value: string;
  divided?: boolean;
}

export function SummaryRow({ label, value, divided = true }: SummaryRowProps) {
  return (
    <View
      className={`flex-row justify-between gap-4 rounded-full px-1 py-1.5 ${
        divided ? '' : 'pb-1'
      }`}
    >
      <AppText muted>{label}</AppText>
      <AppText variant="label" className="flex-1 text-right">
        {value}
      </AppText>
    </View>
  );
}

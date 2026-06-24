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
      className={`flex-row justify-between gap-4 pb-2 ${
        divided ? 'border-b border-border' : ''
      }`}
    >
      <AppText muted>{label}</AppText>
      <AppText variant="label" className="flex-1 text-right">
        {value}
      </AppText>
    </View>
  );
}

import { Pressable, View } from 'react-native';
import type { ReportPeriod } from '@food-tracker/shared';
import { AppText } from './app-text';

interface ReportPeriodSelectorProps {
  period: ReportPeriod;
  onChange: (period: ReportPeriod) => void;
  disabled?: boolean;
}

export function ReportPeriodSelector({
  period,
  onChange,
  disabled = false,
}: ReportPeriodSelectorProps) {
  return (
    <View className="flex-row self-start rounded-full border border-line bg-surface-raised p-1">
      {(['week', 'month'] as const).map((option) => {
        const selected = option === period;
        const label = option === 'week' ? 'Week' : 'Month';
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`${label} reports`}
            className={`min-h-10 min-w-[82px] items-center justify-center rounded-full px-4 ${selected ? 'bg-ink' : ''} ${disabled ? 'opacity-50' : ''}`}
            disabled={disabled}
            onPress={() => onChange(option)}
          >
            <AppText
              variant="label"
              className={selected ? 'text-white' : 'text-muted'}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

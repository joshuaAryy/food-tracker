import { View } from 'react-native';
import { AppText } from './app-text';

interface MacroProgressBarProps {
  label: string;
  consumed: number;
  target: number | null;
  unit?: string;
  color?: string;
}

export function MacroProgressBar({
  label,
  consumed,
  target,
  unit = 'g',
  color = '#7A9B76',
}: MacroProgressBarProps) {
  const progress =
    target === null || target <= 0 ? 0 : Math.min(consumed / target, 1);

  return (
    <View className="gap-2">
      <View className="flex-row items-end justify-between gap-4">
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption" muted className="tabular-nums">
          {consumed.toFixed(1)} / {target?.toFixed(1) ?? '—'} {unit}
        </AppText>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-border">
        <View
          className="h-full rounded-full"
          style={{ width: `${progress * 100}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}

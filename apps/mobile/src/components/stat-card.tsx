import { View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';

interface StatCardProps {
  label: string;
  value: string;
  detail?: string | undefined;
  accent?: 'sage' | 'water' | 'gold' | 'clay';
}

const accentClasses = {
  sage: 'bg-sage',
  water: 'bg-water',
  gold: 'bg-gold',
  clay: 'bg-clay',
} as const;

export function StatCard({
  label,
  value,
  detail,
  accent = 'sage',
}: StatCardProps) {
  return (
    <AppCard className="min-w-[148px] flex-1 gap-3 p-4">
      <View className={`h-1 w-9 rounded-full ${accentClasses[accent]}`} />
      <View className="gap-1">
        <AppText variant="caption" muted>
          {label}
        </AppText>
        <AppText variant="heading" className="tabular-nums">
          {value}
        </AppText>
        {detail === undefined ? null : (
          <AppText variant="caption" muted>
            {detail}
          </AppText>
        )}
      </View>
    </AppCard>
  );
}

import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from './app-text';
import { StreakFlame } from './streak-flame';
import { streakEntryLabel } from '@/lib/reporting-ui';
import { STREAKS_ROUTE } from '@/lib/streak-calendar-ui';

interface StreakEntryActionProps {
  currentStreak: number;
  onPress?: () => void;
}

export function StreakEntryAction({
  currentStreak,
  onPress = () => router.push(STREAKS_ROUTE),
}: StreakEntryActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open streak calendar. ${streakEntryLabel(currentStreak)}.`}
      className="min-h-[44px] self-start flex-row items-center gap-1 py-1"
      onPress={onPress}
    >
      <StreakFlame size={40} />
      <View className="items-start">
        <AppText
          variant="heading"
          className="text-[22px] leading-6 text-ink tabular-nums"
        >
          {Math.max(0, Math.round(currentStreak))}
        </AppText>
        <AppText variant="caption" className="text-muted">
          day
        </AppText>
      </View>
    </Pressable>
  );
}

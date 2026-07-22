import { Pressable } from 'react-native';
import { AppText } from './app-text';
import { StreakFlame } from './streak-flame';
import { router } from 'expo-router';
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
      className="min-h-[44px] self-start flex-row items-center gap-2 py-2 active:opacity-75"
      onPress={onPress}
    >
      <StreakFlame size={24} />
      <AppText variant="label" className="text-ink tabular-nums">
        {streakEntryLabel(currentStreak)}
      </AppText>
    </Pressable>
  );
}

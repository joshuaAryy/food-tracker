import { Pressable, View } from 'react-native';
import { AppText } from './app-text';
import { StreakFlame } from './streak-flame';
import { STREAKS_ROUTE } from '@/lib/streak-calendar-ui';
import { router } from 'expo-router';

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
      accessibilityLabel={`Open streak calendar. Current streak ${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}.`}
      className="min-h-[44px] self-start flex-row items-center gap-2 py-2 active:opacity-75"
      onPress={onPress}
    >
      <StreakFlame size={24} />
      <View className="flex-row items-baseline gap-1">
        <AppText variant="label" className="text-ink tabular-nums">
          {currentStreak}
        </AppText>
        <AppText variant="caption" className="text-muted">
          day{currentStreak === 1 ? '' : 's'} logged
        </AppText>
      </View>
    </Pressable>
  );
}

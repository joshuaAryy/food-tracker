import { ChevronRight, Flame } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { AppText } from './app-text';
import { STREAKS_ROUTE } from '@/lib/streak-calendar-ui';
import { colors } from '@/theme/tokens';
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
      className="min-h-[44px] flex-row items-center gap-2 rounded-full border border-border bg-surface-raised px-3 active:opacity-75"
      onPress={onPress}
    >
      <Flame size={18} color={colors.light.ink} strokeWidth={2.2} />
      <View className="flex-1">
        <AppText variant="caption" className="text-ink">
          {currentStreak} day{currentStreak === 1 ? '' : 's'} logged
        </AppText>
      </View>
      <ChevronRight size={18} color={colors.light.muted} />
    </Pressable>
  );
}

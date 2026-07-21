import { Pressable, View } from 'react-native';
import { AppText } from './app-text';
import { DayProgressRing } from './day-progress-ring';
import {
  semanticDayLabel,
  shortDayNumber,
  shortWeekday,
  type StreakCalendarDay,
} from '@/lib/streak-calendar-ui';
import type { StreakCalendarResponse } from '@food-tracker/shared';

interface MonthlyStreakCalendarProps {
  calendar: StreakCalendarResponse;
  onDayPress?: (day: StreakCalendarDay) => void;
}

export function MonthlyStreakCalendar({
  calendar,
  onDayPress,
}: MonthlyStreakCalendarProps) {
  const acceptedUpperRatio = calendar.acceptedCalorieRange?.upperRatio ?? null;

  return (
    <View
      className="gap-2"
      accessibilityLabel="Sunday through Saturday streak calendar"
    >
      <View className="flex-row">
        {calendar.weeks[0]?.days.map((day) => (
          <View key={`weekday-${day.date}`} className="flex-1 items-center">
            <AppText variant="caption" muted>
              {shortWeekday(day.date).slice(0, 2)}
            </AppText>
          </View>
        ))}
      </View>
      <View className="gap-1">
        {calendar.weeks.map((week) => (
          <View
            key={week.startDate}
            className="relative flex-row items-center rounded-app py-1"
          >
            {week.goldWeek ? (
              <View className="absolute left-3 right-3 top-1/2 h-1 rounded-full bg-sage-soft" />
            ) : null}
            {week.days.map((day) => (
              <View key={day.date} className="flex-1 items-center">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={semanticDayLabel(day)}
                  hitSlop={6}
                  className={`min-h-[44px] w-full items-center justify-center rounded-full ${day.monthRelation === 'current' ? '' : 'opacity-45'}`}
                  onPress={
                    onDayPress === undefined ? undefined : () => onDayPress(day)
                  }
                >
                  <DayProgressRing
                    day={day}
                    acceptedUpperRatio={acceptedUpperRatio}
                  />
                  <AppText
                    variant="caption"
                    className="mt-0.5 text-[10px] leading-3 text-muted"
                  >
                    {shortDayNumber(day.date)}
                  </AppText>
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

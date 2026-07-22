import { Pressable, View } from 'react-native';
import { AppText } from './app-text';
import { DayProgressRing } from './day-progress-ring';
import { StreakGoldBand } from './streak-gold-band';
import {
  DAY_CELL_SIZE,
  isPreTrackingCalendar,
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

const DAY_CELL_HEIGHT = 58;
const CALENDAR_WIDTH = DAY_CELL_SIZE * 7;

interface CalendarDayPressableProps {
  day: StreakCalendarDay;
  acceptedUpperRatio: number | null;
  preTracking: boolean;
  onDayPress?: ((day: StreakCalendarDay) => void) | undefined;
}

function CalendarDayPressable({
  day,
  acceptedUpperRatio,
  preTracking,
  onDayPress,
}: CalendarDayPressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={semanticDayLabel(day)}
      hitSlop={6}
      className="items-center justify-start active:opacity-75"
      style={{ width: DAY_CELL_SIZE, height: DAY_CELL_HEIGHT }}
      onPress={onDayPress === undefined ? undefined : () => onDayPress(day)}
    >
      <View style={{ position: 'absolute', top: 5, left: 5 }}>
        <DayProgressRing
          day={day}
          acceptedUpperRatio={acceptedUpperRatio}
          preTracking={preTracking}
        />
      </View>
    </Pressable>
  );
}

function GoldWeekDayPressable({
  day,
  onDayPress,
}: Pick<CalendarDayPressableProps, 'day' | 'onDayPress'>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={semanticDayLabel(day)}
      hitSlop={6}
      className="items-center justify-start active:opacity-75"
      style={{ width: DAY_CELL_SIZE, height: DAY_CELL_HEIGHT }}
      onPress={onDayPress === undefined ? undefined : () => onDayPress(day)}
    >
      <View
        className="items-center justify-center"
        style={{ position: 'absolute', top: 5, left: 5, width: 34, height: 34 }}
      >
        <AppText
          variant="caption"
          className="text-[12px] font-semibold leading-4 text-ink"
        >
          {shortDayNumber(day.date)}
        </AppText>
      </View>
    </Pressable>
  );
}

export function MonthlyStreakCalendar({
  calendar,
  onDayPress,
}: MonthlyStreakCalendarProps) {
  const acceptedUpperRatio = calendar.acceptedCalorieRange?.upperRatio ?? null;
  const preTracking = isPreTrackingCalendar(calendar);

  return (
    <View
      className="self-center gap-2"
      accessibilityLabel="Sunday through Saturday streak calendar"
      style={{ width: CALENDAR_WIDTH }}
    >
      <View className="flex-row" style={{ width: CALENDAR_WIDTH }}>
        {calendar.weeks[0]?.days.map((day) => (
          <View
            key={`weekday-${day.date}`}
            className="items-center"
            style={{ width: DAY_CELL_SIZE }}
          >
            <AppText variant="caption" muted>
              {shortWeekday(day.date).slice(0, 2)}
            </AppText>
          </View>
        ))}
      </View>
      <View className="gap-1">
        {calendar.weeks.map((week) =>
          week.goldWeek ? (
            <StreakGoldBand key={week.startDate} variant="week">
              {week.days.map((day) => (
                <GoldWeekDayPressable
                  key={day.date}
                  day={day}
                  onDayPress={onDayPress}
                />
              ))}
            </StreakGoldBand>
          ) : (
            <View
              key={week.startDate}
              className="flex-row"
              style={{ width: CALENDAR_WIDTH, height: DAY_CELL_HEIGHT }}
            >
              {week.days.map((day) => (
                <CalendarDayPressable
                  key={day.date}
                  day={day}
                  acceptedUpperRatio={acceptedUpperRatio}
                  preTracking={preTracking}
                  onDayPress={onDayPress}
                />
              ))}
            </View>
          ),
        )}
      </View>
    </View>
  );
}

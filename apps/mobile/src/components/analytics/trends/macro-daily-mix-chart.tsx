import { View } from 'react-native';
import { AppText } from '@/components/app-text';
import { formatPresentationDate } from '@/lib/date-time';

type DailyMix = {
  date: string;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

const BAR_HEIGHT = 150;

const segmentColors = {
  protein: '#C9242D',
  carbs: '#33B866',
  fat: '#FFAD8F',
} as const;

function weekdayLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(`${date}T12:00:00.000Z`))
    .slice(0, 1);
}

export function MacroDailyMixChart({ days }: { days: readonly DailyMix[] }) {
  return (
    <View
      testID="macro-daily-mix-chart"
      accessible
      accessibilityLabel="Daily macro mix"
      className="gap-2"
    >
      <AppText variant="caption" className="text-muted">
        g
      </AppText>
      <View className="h-[150px] flex-row items-end justify-between gap-3 border-b border-line px-1">
        {days.map((day) => (
          <View
            key={day.date}
            className="h-full flex-1 items-center justify-end"
            accessible
            accessibilityLabel={`${formatPresentationDate(day.date)} macro composition`}
          >
            <View
              className="w-4 overflow-hidden rounded-t-[4px]"
              style={{ height: BAR_HEIGHT }}
            >
              {(
                [
                  ['fat', day.fat],
                  ['carbs', day.carbs],
                  ['protein', day.protein],
                ] as const
              ).map(([key, value]) =>
                value === null || value <= 0 ? null : (
                  <View
                    key={key}
                    className="min-h-[2px] flex-1 border-b border-white"
                    style={{
                      flex: value,
                      backgroundColor: segmentColors[key],
                    }}
                  />
                ),
              )}
            </View>
          </View>
        ))}
      </View>
      <View className="flex-row justify-between gap-3 px-1">
        {days.map((day) => (
          <AppText
            key={day.date}
            variant="caption"
            className="flex-1 text-center text-muted"
          >
            {weekdayLabel(day.date)}
          </AppText>
        ))}
      </View>
    </View>
  );
}

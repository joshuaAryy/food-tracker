import { View } from 'react-native';
import { AppText } from './app-text';
import { GraceLaurelIcon } from './grace-laurel-icon';
import { RadialProgressRing } from './radial-progress-ring';
import { StreakGoldBand } from './streak-gold-band';
import {
  calendarDayAppearance,
  clamp,
  consumingCharcoalFraction,
  DAY_RING_SIZE,
  DAY_RING_STROKE,
  shortDayNumber,
  type StreakCalendarDay,
} from '@/lib/streak-calendar-ui';
import { colors } from '@/theme/tokens';

interface DayProgressRingProps {
  day: StreakCalendarDay;
  acceptedUpperRatio: number | null;
  preTracking?: boolean;
  size?: number;
}

function DayNumber({ day }: { day: StreakCalendarDay }) {
  return (
    <AppText
      variant="caption"
      className="text-[12px] font-semibold leading-4 text-ink"
    >
      {shortDayNumber(day.date)}
    </AppText>
  );
}

export function DayProgressRing({
  day,
  acceptedUpperRatio,
  preTracking = false,
  size = DAY_RING_SIZE,
}: DayProgressRingProps) {
  const appearance = calendarDayAppearance(day, preTracking);
  const progress = clamp(day.calorieRatio ?? 0);
  const charcoalFraction =
    acceptedUpperRatio === null
      ? 0
      : consumingCharcoalFraction(day.calorieRatio, acceptedUpperRatio);

  if (appearance.visual === 'plain') {
    return (
      <View
        className="items-center justify-center"
        style={{ width: size, height: size }}
      >
        <DayNumber day={day} />
      </View>
    );
  }

  if (appearance.visual === 'gold') {
    return (
      <StreakGoldBand variant="day" size={size}>
        <DayNumber day={day} />
      </StreakGoldBand>
    );
  }

  if (appearance.visual === 'grace') {
    return (
      <View
        className="items-center justify-center"
        style={{ width: size, height: size }}
      >
        <GraceLaurelIcon size={size} />
        <View className="absolute items-center justify-center">
          <DayNumber day={day} />
        </View>
      </View>
    );
  }

  const isDotted = appearance.visual === 'dotted';
  const isComplete = appearance.visual === 'green-complete';
  const isOverTarget = appearance.visual === 'over-target';

  return (
    <RadialProgressRing
      progress={isDotted ? 0 : isComplete || isOverTarget ? 1 : progress}
      size={size}
      strokeWidth={DAY_RING_STROKE}
      trackColor={isDotted ? colors.light.line : colors.light.primarySoft}
      {...(isDotted ? { trackDasharray: [1, 4] } : {})}
      progressColor={colors.light.sageDark}
      charcoalFraction={isOverTarget ? charcoalFraction : 0}
      charcoalColor={colors.light.ink}
    >
      <DayNumber day={day} />
    </RadialProgressRing>
  );
}

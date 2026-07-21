import { AppText } from './app-text';
import { RadialProgressRing } from './radial-progress-ring';
import type { StreakCalendarDay } from '@/lib/streak-calendar-ui';
import {
  consumingCharcoalFraction,
  semanticDayLabel,
} from '@/lib/streak-calendar-ui';
import { colors } from '@/theme/tokens';

const stateAppearance: Record<
  StreakCalendarDay['streakState'],
  { color: string; cue: string }
> = {
  future: { color: colors.light.border, cue: '·' },
  open: { color: colors.light.subtle, cue: '○' },
  missed: { color: colors.light.error, cue: '×' },
  logged_without_target: { color: colors.light.water, cue: '•' },
  partial: { color: colors.light.carbs, cue: '◐' },
  gold: { color: colors.light.sageDark, cue: '✓' },
  over_target: { color: colors.light.ink, cue: '↑' },
  grace: { color: colors.light.muted, cue: 'G' },
};

interface DayProgressRingProps {
  day: StreakCalendarDay;
  acceptedUpperRatio: number | null;
  size?: number;
}

export function DayProgressRing({
  day,
  acceptedUpperRatio,
  size = 32,
}: DayProgressRingProps) {
  const appearance = stateAppearance[day.streakState];
  const progress =
    day.calorieRatio === null ? 0 : Math.min(day.calorieRatio, 1);
  const charcoalFraction =
    acceptedUpperRatio === null
      ? 0
      : consumingCharcoalFraction(day.calorieRatio, acceptedUpperRatio);

  return (
    <RadialProgressRing
      progress={progress}
      size={size}
      strokeWidth={4}
      progressColor={appearance.color}
      trackColor={colors.light.line}
      charcoalFraction={charcoalFraction}
      charcoalColor={colors.light.ink}
      accessibilityLabel={semanticDayLabel(day)}
    >
      <AppText variant="caption" className="text-[10px] leading-3 text-ink">
        {day.streakState === 'future' ? '·' : appearance.cue}
      </AppText>
    </RadialProgressRing>
  );
}

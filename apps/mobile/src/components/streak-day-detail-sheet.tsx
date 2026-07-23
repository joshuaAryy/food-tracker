import { Modal, Pressable, ScrollView, View } from 'react-native';
import type { StreakCalendarResponse } from '@food-tracker/shared';
import { AppText } from './app-text';
import {
  dayDetailFacts,
  type StreakCalendarDay,
} from '@/lib/streak-calendar-ui';

interface StreakDayDetailSheetProps {
  day: StreakCalendarDay | null;
  visible: boolean;
  activeCalorieTarget: number | null;
  acceptedCalorieRange: StreakCalendarResponse['acceptedCalorieRange'];
  goldWeek: boolean;
  onClose: () => void;
}

interface DetailRowProps {
  label: string;
  value: string;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-2.5">
      <AppText variant="caption" className="flex-1 text-muted">
        {label}
      </AppText>
      <AppText variant="caption" className="max-w-[62%] text-right text-ink">
        {value}
      </AppText>
    </View>
  );
}

export function StreakDayDetailSheet({
  day,
  visible,
  activeCalorieTarget,
  acceptedCalorieRange,
  goldWeek,
  onClose,
}: StreakDayDetailSheetProps) {
  const facts =
    day === null
      ? null
      : dayDetailFacts(
          day,
          activeCalorieTarget,
          acceptedCalorieRange,
          goldWeek,
        );

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible && facts !== null}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-ink/30">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss day details"
          className="absolute inset-0"
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          className="max-h-[86%] rounded-t-[30px] bg-surface px-5 pt-3"
        >
          {facts === null ? null : (
            <>
              <View className="items-center pb-3">
                <View className="h-1.5 w-10 rounded-full bg-ink" />
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 32 }}
              >
                <View className="flex-row items-start justify-between gap-4 pb-4">
                  <View className="min-w-0 flex-1 gap-1">
                    <AppText variant="caption" className="text-muted">
                      Day details
                    </AppText>
                    <AppText variant="heading" className="text-ink">
                      {facts.fullDate}
                    </AppText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close day details"
                    className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border px-3 active:opacity-70"
                    onPress={onClose}
                  >
                    <AppText variant="label" className="text-primary-dark">
                      Close
                    </AppText>
                  </Pressable>
                </View>

                <View className="border-y border-line">
                  <DetailRow
                    label="Calories logged"
                    value={facts.caloriesLogged}
                  />
                  <DetailRow label="Active target" value={facts.activeTarget} />
                  <DetailRow
                    label="Accepted range"
                    value={facts.acceptedRange}
                  />
                  <DetailRow label="Status" value={facts.status} />
                  <DetailRow
                    label="Target context"
                    value={facts.targetDifference}
                  />
                </View>

                <View className="pt-3">
                  <DetailRow label="Logging" value={facts.loggedMeaning} />
                  <DetailRow label="Gold" value={facts.goldMeaning} />
                  <DetailRow
                    label="Perfect week"
                    value={facts.perfectWeekMeaning}
                  />
                  {facts.graceExplanation === null ? null : (
                    <DetailRow
                      label="Grace day"
                      value={facts.graceExplanation}
                    />
                  )}
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

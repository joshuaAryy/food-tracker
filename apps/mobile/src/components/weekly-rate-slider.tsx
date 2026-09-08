import Slider from '@react-native-community/slider';
import { View } from 'react-native';
import { RATE_STEP_LB_PER_WEEK } from '@food-tracker/shared';
import { AppText } from './app-text';

interface WeeklyRateSliderProps {
  minimumValue: number;
  maximumValue: number;
  value: number;
  onValueChange: (value: number) => void;
}

export function WeeklyRateSlider({
  minimumValue,
  maximumValue,
  value,
  onValueChange,
}: WeeklyRateSliderProps) {
  return (
    <View className="gap-2">
      <AppText variant="heading">{value.toFixed(2)} lb/week</AppText>
      <Slider
        accessibilityLabel="Weekly rate"
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={RATE_STEP_LB_PER_WEEK}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor="#2F6F63"
        maximumTrackTintColor="#D7D4C9"
      />
      <View className="flex-row justify-between">
        <AppText variant="caption" muted>
          Slower · {minimumValue.toFixed(2)}
        </AppText>
        <AppText variant="caption" muted>
          Faster · {maximumValue.toFixed(2)}
        </AppText>
      </View>
    </View>
  );
}

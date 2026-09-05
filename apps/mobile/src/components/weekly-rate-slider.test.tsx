import { fireEvent, render } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { WeeklyRateSlider } from './weekly-rate-slider';

vi.mock('@react-native-community/slider', () => ({
  __esModule: true,
  default: (props: { onValueChange: (value: number) => void }) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => props.onValueChange(0.55)}
    />
  ),
}));

describe('WeeklyRateSlider', () => {
  it('shows the selected rate and emits slider changes', async () => {
    const onValueChange = vi.fn();
    const { getByText, getByRole } = await render(
      <WeeklyRateSlider
        minimumValue={0.25}
        maximumValue={1.1}
        value={0.5}
        onValueChange={onValueChange}
      />,
    );

    expect(getByText('0.50 lb/week')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onValueChange).toHaveBeenCalledWith(0.55);
  });
});

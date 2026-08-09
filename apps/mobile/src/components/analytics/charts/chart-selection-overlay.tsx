import { Pressable, View } from 'react-native';

export function ChartSelectionOverlay({
  width,
  height,
  onScrub,
}: {
  width: number;
  height: number;
  onScrub: (x: number) => void;
}) {
  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel="Inspect chart values"
      className="absolute left-0 top-0"
      style={{ width, height }}
      onPress={(event) => onScrub(event.nativeEvent.locationX)}
      onPressIn={(event) => onScrub(event.nativeEvent.locationX)}
    >
      <View style={{ width, height }} />
    </Pressable>
  );
}

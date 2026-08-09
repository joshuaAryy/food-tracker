import { useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export function ChartSelectionOverlay({
  width,
  height,
  onScrub,
  onAccessibilityStep,
}: {
  width: number;
  height: number;
  onScrub: (x: number) => void;
  onAccessibilityStep?:
    | ((direction: 'increment' | 'decrement') => void)
    | undefined;
}) {
  const gesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Pan()
          .activeOffsetX([-4, 4])
          .failOffsetY([-8, 8])
          .runOnJS(true)
          .onBegin((event) => onScrub(event.x))
          .onUpdate((event) => onScrub(event.x)),
        Gesture.Tap()
          .runOnJS(true)
          .onEnd((event) => onScrub(event.x)),
      ),
    [onScrub],
  );
  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Inspect chart values"
        accessibilityActions={
          onAccessibilityStep === undefined
            ? undefined
            : [
                { name: 'increment', label: 'Next date' },
                { name: 'decrement', label: 'Previous date' },
              ]
        }
        onAccessibilityAction={(event) => {
          if (
            event.nativeEvent.actionName === 'increment' ||
            event.nativeEvent.actionName === 'decrement'
          ) {
            onAccessibilityStep?.(event.nativeEvent.actionName);
          }
        }}
        className="absolute left-0 top-0"
        style={{ width, height }}
      />
    </GestureDetector>
  );
}

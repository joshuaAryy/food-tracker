import { useEffect, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { AppText } from './app-text';

export const wheelItemHeight = 48;
export const wheelVisibleRows = 5;
export const wheelVerticalPadding =
  (wheelItemHeight * (wheelVisibleRows - 1)) / 2;
export const wheelHeight = wheelItemHeight * wheelVisibleRows;

interface OnboardingWheelColumnProps<T extends string | number> {
  accessibilityLabel: string;
  values: readonly T[];
  selectedValue: T;
  labelForValue: (value: T) => string;
  onSelect: (value: T) => void;
  selectedTextClassName?: string;
  mutedTextClassName?: string;
}

export function valuesBetween(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function OnboardingWheelColumn<T extends string | number>({
  accessibilityLabel,
  values,
  selectedValue,
  labelForValue,
  onSelect,
  selectedTextClassName = 'text-onboarding-text',
  mutedTextClassName = 'text-onboarding-muted',
}: OnboardingWheelColumnProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(values.indexOf(selectedValue), 0);
  const scrollToIndex = (index: number, animated: boolean) => {
    scrollRef.current?.scrollTo({
      y: Math.max(index, 0) * wheelItemHeight,
      animated,
    });
  };

  useEffect(() => {
    scrollToIndex(selectedIndex, false);
  }, [selectedIndex, values.length]);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.min(
      Math.max(
        Math.round(event.nativeEvent.contentOffset.y / wheelItemHeight),
        0,
      ),
      values.length - 1,
    );
    const nextValue = values[nextIndex];

    if (nextValue !== undefined && nextValue !== selectedValue) {
      onSelect(nextValue);
    } else {
      scrollToIndex(selectedIndex, true);
    }
  };
  const handleDragEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const velocityY = event.nativeEvent.velocity?.y ?? 0;

    if (Math.abs(velocityY) < 0.1) {
      handleScrollEnd(event);
    }
  };

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      className="flex-1 overflow-hidden"
      style={{ height: wheelHeight }}
    >
      <ScrollView
        ref={scrollRef}
        bounces={false}
        decelerationRate="fast"
        disableIntervalMomentum
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleDragEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={wheelItemHeight}
        contentContainerStyle={{
          paddingBottom: wheelVerticalPadding,
          paddingTop: wheelVerticalPadding,
        }}
      >
        {values.map((item, index) => {
          const selected = item === selectedValue;

          return (
            <Pressable
              key={String(item)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className="items-center justify-center px-1 active:opacity-70"
              style={{ height: wheelItemHeight }}
              onPress={() => {
                scrollToIndex(index, true);
                onSelect(item);
              }}
            >
              <AppText
                variant={selected ? 'heading' : 'body'}
                className={`text-center tabular-nums ${
                  selected ? selectedTextClassName : mutedTextClassName
                }`}
              >
                {labelForValue(item)}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

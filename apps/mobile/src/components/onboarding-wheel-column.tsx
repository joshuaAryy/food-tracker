import { useCallback, useEffect, useRef, useState } from 'react';
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
  mutedTextClassName = 'text-onboarding-muted opacity-45',
}: OnboardingWheelColumnProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const frameRef = useRef<number | null>(null);
  const dragEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const selectedIndex = Math.max(values.indexOf(selectedValue), 0);
  const scrollToIndex = useCallback((index: number, animated: boolean) => {
    scrollRef.current?.scrollTo({
      y: Math.max(index, 0) * wheelItemHeight,
      animated,
    });
  }, []);

  const scrollToSelectedIndex = useCallback(
    (animated: boolean) => {
      if (!layoutReady || !contentReady) return;

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = requestAnimationFrame(() => {
        scrollToIndex(selectedIndex, animated);
        frameRef.current = null;
      });
    },
    [contentReady, layoutReady, scrollToIndex, selectedIndex],
  );

  const clearDragEndCorrection = useCallback(() => {
    if (dragEndTimeoutRef.current !== null) {
      clearTimeout(dragEndTimeoutRef.current);
      dragEndTimeoutRef.current = null;
    }
  }, []);

  const finishScroll = useCallback(
    (offsetY: number) => {
      const nextIndex = Math.min(
        Math.max(Math.round(offsetY / wheelItemHeight), 0),
        values.length - 1,
      );
      const nextValue = values[nextIndex];

      if (nextValue === undefined) {
        scrollToIndex(selectedIndex, true);
        return;
      }

      scrollToIndex(nextIndex, true);

      if (nextValue !== selectedValue) {
        onSelect(nextValue);
      }
    },
    [onSelect, scrollToIndex, selectedIndex, selectedValue, values],
  );

  useEffect(() => {
    scrollToSelectedIndex(false);
  }, [scrollToSelectedIndex, values.length]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      clearDragEndCorrection();
    },
    [clearDragEndCorrection],
  );

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    clearDragEndCorrection();
    finishScroll(event.nativeEvent.contentOffset.y);
  };
  const handleDragEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;

    clearDragEndCorrection();
    dragEndTimeoutRef.current = setTimeout(() => {
      finishScroll(offsetY);
      dragEndTimeoutRef.current = null;
    }, 120);
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
        decelerationRate="normal"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          setContentReady(true);
        }}
        onLayout={() => {
          setLayoutReady(true);
        }}
        onMomentumScrollBegin={clearDragEndCorrection}
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
                variant={selected ? 'title' : 'body'}
                className={`text-center tabular-nums leading-[48px] ${
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

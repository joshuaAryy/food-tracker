import { useEffect, useMemo, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { AppText } from './app-text';

const monthLabels = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const mutedWheelText = '#7A7F75';
const darkPrimaryText = '#F7F7F4';
const darkSecondaryText = '#C9CCC4';
const wheelItemHeight = 46;
const wheelVisibleRows = 5;
const wheelVerticalPadding = (wheelItemHeight * (wheelVisibleRows - 1)) / 2;
const wheelHeight = wheelItemHeight * wheelVisibleRows;

export interface DateWheelValue {
  month: number;
  day: number;
  year: number;
}

interface WheelColumnProps {
  accessibilityLabel: string;
  values: readonly number[];
  selectedValue: number;
  labelForValue: (value: number) => string;
  onSelect: (value: number) => void;
}

interface OnboardingDateWheelProps {
  value: DateWheelValue;
  onChange: (value: DateWheelValue) => void;
}

function currentUtcDate() {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
}

export function daysInMonth(month: number, year: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function clampDateWheelValue(value: DateWheelValue): DateWheelValue {
  const today = currentUtcDate();
  const year = Math.min(Math.max(value.year, today.year - 100), today.year);
  const maxMonth = year === today.year ? today.month : 12;
  const month = Math.min(Math.max(value.month, 1), maxMonth);
  const maxDay =
    year === today.year && month === today.month
      ? today.day
      : daysInMonth(month, year);
  const day = Math.min(Math.max(value.day, 1), maxDay);

  return { month, day, year };
}

function valuesBetween(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function dateWheelAgeLabel(value: DateWheelValue): string {
  const birthDate = new Date(Date.UTC(value.year, value.month - 1, value.day));
  const now = new Date();
  let age = now.getFullYear() - value.year;
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  if (
    currentMonth < value.month ||
    (currentMonth === value.month && currentDay < value.day)
  ) {
    age -= 1;
  }

  if (
    birthDate.getUTCFullYear() !== value.year ||
    birthDate.getUTCMonth() !== value.month - 1 ||
    birthDate.getUTCDate() !== value.day ||
    age < 0
  ) {
    return '-';
  }

  return String(age);
}

function selectedDateLabel(value: DateWheelValue): string {
  const month = monthLabels[value.month - 1] ?? String(value.month);
  return `${month} ${value.day}, ${value.year}`;
}

function WheelColumn({
  accessibilityLabel,
  values,
  selectedValue,
  labelForValue,
  onSelect,
}: WheelColumnProps) {
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
              key={item}
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
                  selected ? 'text-onboarding-text' : 'text-onboarding-muted'
                }`}
                style={selected ? undefined : { color: mutedWheelText }}
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

export function OnboardingDateWheel({
  value,
  onChange,
}: OnboardingDateWheelProps) {
  const today = currentUtcDate();
  const clampedValue = clampDateWheelValue(value);
  const ageLabel = dateWheelAgeLabel(clampedValue);
  const years = useMemo(
    () => valuesBetween(today.year - 100, today.year).reverse(),
    [today.year],
  );
  const months = useMemo(() => {
    const maxMonth = clampedValue.year === today.year ? today.month : 12;
    return valuesBetween(1, maxMonth);
  }, [clampedValue.year, today.month]);
  const days = useMemo(() => {
    const maxDay =
      clampedValue.year === today.year && clampedValue.month === today.month
        ? today.day
        : daysInMonth(clampedValue.month, clampedValue.year);
    return valuesBetween(1, maxDay);
  }, [
    clampedValue.month,
    clampedValue.year,
    today.day,
    today.month,
    today.year,
  ]);

  useEffect(() => {
    if (
      clampedValue.month !== value.month ||
      clampedValue.day !== value.day ||
      clampedValue.year !== value.year
    ) {
      onChange(clampedValue);
    }
  }, [clampedValue, onChange, value.day, value.month, value.year]);

  const updateValue = (next: Partial<DateWheelValue>) => {
    onChange(clampDateWheelValue({ ...clampedValue, ...next }));
  };

  return (
    <View className="overflow-hidden rounded-[26px] bg-onboarding-surface px-4 py-5 shadow-sm">
      <View className="relative">
        <View
          className="absolute left-0 right-0 rounded-[18px] bg-onboarding-accent-soft"
          style={{
            height: wheelItemHeight,
            top: wheelVerticalPadding,
          }}
        />
        <View
          className="absolute left-0 right-0 h-px bg-onboarding-line"
          style={{ top: wheelVerticalPadding }}
        />
        <View
          className="absolute left-0 right-0 h-px bg-onboarding-line"
          style={{ top: wheelVerticalPadding + wheelItemHeight }}
        />
        <View className="flex-row gap-2">
          <WheelColumn
            accessibilityLabel="Birth month"
            values={months}
            selectedValue={clampedValue.month}
            labelForValue={(month) => monthLabels[month - 1] ?? String(month)}
            onSelect={(month) => updateValue({ month })}
          />
          <WheelColumn
            accessibilityLabel="Birth day"
            values={days}
            selectedValue={clampedValue.day}
            labelForValue={(day) => String(day)}
            onSelect={(day) => updateValue({ day })}
          />
          <WheelColumn
            accessibilityLabel="Birth year"
            values={years}
            selectedValue={clampedValue.year}
            labelForValue={(year) => String(year)}
            onSelect={(year) => updateValue({ year })}
          />
        </View>
      </View>
      <View className="mt-5 flex-row items-center justify-between rounded-[18px] bg-onboarding-text px-4 py-3">
        <AppText
          variant="caption"
          className="text-white"
          style={{ color: darkSecondaryText }}
        >
          Calculated age
        </AppText>
        <AppText
          variant="heading"
          className="text-white tabular-nums"
          style={{ color: darkPrimaryText }}
        >
          {ageLabel === '-' ? '-' : `${ageLabel} years`}
        </AppText>
      </View>
      <AppText
        variant="caption"
        className="mt-3 text-center text-onboarding-muted"
      >
        Selected date: {selectedDateLabel(clampedValue)}
      </AppText>
    </View>
  );
}

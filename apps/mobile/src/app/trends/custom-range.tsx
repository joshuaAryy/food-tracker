import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  TextInput,
  type LayoutChangeEvent,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import {
  clampRailViewport,
  customRangeAggregationLabel,
  dateForRailPosition,
  moveCustomRangeHandle,
  panRailViewport,
  rangeShortcut,
  selectCustomRangeEndpoint,
  zoomRailViewport,
  type CustomRangeSelection,
  type RailViewport,
} from '@/lib/analytics/custom-range';
import {
  trendQueryFromRouteParam,
  trendQueryRouteParam,
} from '@/lib/analytics/saved-view-configuration';

const shortcuts = [7, 30, 90] as const;

function sameSelection(
  first: CustomRangeSelection,
  second: CustomRangeSelection,
) {
  return (
    first.startDate === second.startDate && first.endDate === second.endDate
  );
}

export default function CustomRangeScreen() {
  const router = useRouter();
  const { query: rawQuery } = useLocalSearchParams<{ query?: string }>();
  const draft = useMemo(() => trendQueryFromRouteParam(rawQuery), [rawQuery]);
  const [bounds, setBounds] = useState<{
    firstEligibleDate: string;
    today: string;
  } | null>(null);
  const [selection, setSelection] = useState<CustomRangeSelection | null>(null);
  const [viewport, setViewport] = useState<RailViewport | null>(null);
  const [railWidth, setRailWidth] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const activeHandle = useRef<'start' | 'end'>('start');
  const lastHapticDate = useRef<{ start?: string; end?: string }>({});

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/trends/configure' as never);
  };

  const loadBounds = useCallback(async () => {
    if (draft === null) return;
    setError(null);
    try {
      const response = await api.analytics.trend({
        ...draft,
        period: { kind: 'relative', days: 7 },
      });
      const nextBounds = {
        firstEligibleDate: response.firstEligibleDate ?? response.today,
        today: response.today,
      };
      const nextSelection =
        draft.period.kind === 'custom'
          ? selectCustomRangeEndpoint({
              endpoint: 'end',
              proposedDate: draft.period.endDate,
              startDate: draft.period.startDate,
              endDate: draft.period.endDate,
              ...nextBounds,
            })
          : rangeShortcut({ days: 30, ...nextBounds });
      setBounds(nextBounds);
      setSelection(nextSelection);
      setViewport(
        clampRailViewport({
          startDate: nextSelection.startDate,
          endDate: nextSelection.endDate,
          ...nextBounds,
        }),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [draft]);

  useEffect(() => {
    void loadBounds();
  }, [loadBounds]);

  const updateSelection = useCallback(
    (handle: 'start' | 'end', proposedDate: string) => {
      if (selection === null || bounds === null) return;
      const next = moveCustomRangeHandle({
        handle,
        proposedDate,
        ...selection,
        ...bounds,
      });
      if (sameSelection(next, selection)) return;
      setSelection(next);
      const changedDate = handle === 'start' ? next.startDate : next.endDate;
      if (lastHapticDate.current[handle] !== changedDate) {
        lastHapticDate.current[handle] = changedDate;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [bounds, selection],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          selection !== null && bounds !== null,
        onMoveShouldSetPanResponder: () =>
          selection !== null && bounds !== null,
        onPanResponderGrant: (event) => {
          if (selection === null || bounds === null) return;
          const startPosition = datePosition(selection.startDate, viewport);
          const endPosition = datePosition(selection.endDate, viewport);
          activeHandle.current =
            Math.abs(event.nativeEvent.locationX / railWidth - startPosition) <=
            Math.abs(event.nativeEvent.locationX / railWidth - endPosition)
              ? 'start'
              : 'end';
        },
        onPanResponderMove: (event) => {
          if (bounds === null || viewport === null) return;
          updateSelection(
            activeHandle.current,
            dateAtPosition(
              event.nativeEvent.locationX / railWidth,
              bounds,
              viewport,
            ),
          );
        },
      }),
    [bounds, railWidth, selection, updateSelection, viewport],
  );

  const onRailLayout = (event: LayoutChangeEvent) => {
    setRailWidth(Math.max(1, event.nativeEvent.layout.width));
  };

  if (draft === null) {
    return (
      <AppScreen>
        <ErrorState
          title="Custom Range is unavailable"
          message="Return to a Trend and try again."
          onRetry={close}
        />
      </AppScreen>
    );
  }

  const apply = () => {
    if (selection === null) return;
    router.replace({
      pathname: '/trends/configure',
      params: {
        query: trendQueryRouteParam({
          ...draft,
          period: {
            kind: 'custom',
            startDate: selection.startDate,
            endDate: selection.endDate,
          },
        }),
      },
    } as never);
  };

  return (
    <AppScreen
      contentClassName="gap-5 pb-8"
      footer={
        <AppButton onPress={apply} disabled={selection === null}>
          Use this range
        </AppButton>
      }
    >
      <ScreenHeader
        title="Custom Range"
        subtitle="Select any eligible logged day through today."
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Custom Range"
            className="min-h-11 justify-center"
            onPress={close}
          >
            <AppText variant="label">Close</AppText>
          </Pressable>
        }
      />
      {error === null ? null : (
        <ErrorState message={error} onRetry={() => void loadBounds()} />
      )}
      {selection === null || bounds === null || viewport === null ? (
        <AppText muted>Loading available history…</AppText>
      ) : (
        <>
          <View className="gap-2">
            <AppText variant="label">Quick ranges</AppText>
            <View className="flex-row flex-wrap gap-2">
              {shortcuts.map((days) => (
                <Pressable
                  key={days}
                  accessibilityRole="button"
                  className="min-h-11 rounded-full bg-module px-4 py-3"
                  onPress={() => {
                    const next = rangeShortcut({ days, ...bounds });
                    setSelection(next);
                    setViewport(clampRailViewport({ ...next, ...bounds }));
                  }}
                >
                  <AppText>{days}D</AppText>
                </Pressable>
              ))}
            </View>
          </View>
          <View className="gap-2">
            <AppText variant="label">History rail</AppText>
            <View
              accessibilityRole="adjustable"
              accessibilityLabel="Custom date range history rail"
              accessibilityValue={{
                text: `${selection.startDate} through ${selection.endDate}`,
              }}
              className="h-16 justify-center rounded-app bg-module px-3"
              onLayout={onRailLayout}
              {...panResponder.panHandlers}
            >
              <View className="h-1 rounded-full bg-line" />
              <View
                pointerEvents="none"
                className="absolute h-2 rounded-full bg-ink"
                style={{
                  left: `${datePosition(selection.startDate, viewport) * 100}%`,
                  right: `${(1 - datePosition(selection.endDate, viewport)) * 100}%`,
                }}
              />
            </View>
            <View className="flex-row justify-between gap-2">
              <AppButton
                variant="secondary"
                onPress={() =>
                  setViewport(
                    panRailViewport({ viewport, deltaDays: -7, ...bounds }),
                  )
                }
              >
                Earlier
              </AppButton>
              <AppButton
                variant="secondary"
                onPress={() =>
                  setViewport(
                    zoomRailViewport({
                      viewport,
                      factor: 0.5,
                      focalDate: selection.startDate,
                      ...bounds,
                    }),
                  )
                }
              >
                Zoom in
              </AppButton>
              <AppButton
                variant="secondary"
                onPress={() =>
                  setViewport(
                    panRailViewport({ viewport, deltaDays: 7, ...bounds }),
                  )
                }
              >
                Later
              </AppButton>
            </View>
          </View>
          <View className="gap-2">
            <AppText variant="label">Exact dates</AppText>
            <RangeDateInput
              label="START"
              value={selection.startDate}
              firstEligibleDate={bounds.firstEligibleDate}
              today={bounds.today}
              onSubmit={(proposedDate) =>
                setSelection(
                  selectCustomRangeEndpoint({
                    endpoint: 'start',
                    proposedDate,
                    ...selection,
                    ...bounds,
                  }),
                )
              }
            />
            <RangeDateInput
              label="END"
              value={selection.endDate}
              firstEligibleDate={bounds.firstEligibleDate}
              today={bounds.today}
              onSubmit={(proposedDate) =>
                setSelection(
                  selectCustomRangeEndpoint({
                    endpoint: 'end',
                    proposedDate,
                    ...selection,
                    ...bounds,
                  }),
                )
              }
            />
          </View>
          <AppText muted>
            {selection.days} days ·{' '}
            {customRangeAggregationLabel(selection.days)} by default
          </AppText>
          <AppText variant="caption" muted>
            Available from {bounds.firstEligibleDate} through {bounds.today}.
            Dates are inclusive.
          </AppText>
        </>
      )}
    </AppScreen>
  );
}

function RangeDateInput({
  label,
  value,
  firstEligibleDate,
  today,
  onSubmit,
}: {
  label: string;
  value: string;
  firstEligibleDate: string;
  today: string;
  onSubmit: (date: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [calendarOpen, setCalendarOpen] = useState(false);
  useEffect(() => setDraft(value), [value]);
  return (
    <View className="gap-1">
      <AppText variant="caption">{label}</AppText>
      <TextInput
        accessibilityLabel={`${label} date`}
        className="min-h-11 rounded-control border border-line bg-module px-4 text-ink"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => onSubmit(draft)}
        onBlur={() => onSubmit(draft)}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />
      <Pressable
        accessibilityRole="button"
        className="min-h-11 rounded-control bg-module px-4 py-3"
        onPress={() => setCalendarOpen((open) => !open)}
      >
        <AppText>Choose {label} on calendar</AppText>
      </Pressable>
      {calendarOpen ? (
        <RangeCalendar
          selectedDate={value}
          firstEligibleDate={firstEligibleDate}
          today={today}
          onSelect={(date) => {
            onSubmit(date);
            setCalendarOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

function RangeCalendar({
  selectedDate,
  firstEligibleDate,
  today,
  onSelect,
}: {
  selectedDate: string;
  firstEligibleDate: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const [month, setMonth] = useState(selectedDate.slice(0, 7));
  const days = useMemo(() => calendarDays(month), [month]);
  const previousMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);
  return (
    <View className="gap-2 rounded-app border border-line bg-white p-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          disabled={previousMonth < firstEligibleDate.slice(0, 7)}
          onPress={() => setMonth(previousMonth)}
        >
          <AppText muted>Previous</AppText>
        </Pressable>
        <AppText variant="label">{month}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={nextMonth > today.slice(0, 7)}
          onPress={() => setMonth(nextMonth)}
        >
          <AppText muted>Next</AppText>
        </Pressable>
      </View>
      <View className="flex-row flex-wrap">
        {days.map((date, index) => {
          const available =
            date !== null && date >= firstEligibleDate && date <= today;
          return (
            <Pressable
              key={date ?? `blank-${index}`}
              accessibilityRole="button"
              accessibilityLabel={date === null ? 'Unavailable day' : date}
              accessibilityState={{
                disabled: !available,
                selected: date === selectedDate,
              }}
              disabled={!available}
              className={`min-h-11 w-[14.28%] items-center justify-center ${date === selectedDate ? 'rounded-full bg-ink' : ''}`}
              onPress={() => date !== null && onSelect(date)}
            >
              <AppText
                className={date === selectedDate ? 'text-white' : 'text-ink'}
              >
                {date === null ? '' : Number(date.slice(-2))}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function addMonths(month: string, amount: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(
    Date.UTC(year ?? 0, (monthNumber ?? 1) - 1 + amount, 1),
  );
  return date.toISOString().slice(0, 7);
}

function calendarDays(month: string): (string | null)[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year ?? 0, (monthNumber ?? 1) - 1, 1));
  const weekdayPadding = first.getUTCDay();
  const daysInMonth = new Date(
    Date.UTC(year ?? 0, monthNumber ?? 1, 0),
  ).getUTCDate();
  return [
    ...Array.from({ length: weekdayPadding }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`,
    ),
  ];
}

function datePosition(date: string, viewport: RailViewport | null): number {
  if (viewport === null) return 0;
  return railPositionForViewport(date, viewport);
}

function railPositionForViewport(date: string, viewport: RailViewport): number {
  const start = new Date(`${viewport.startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${viewport.endDate}T00:00:00.000Z`).getTime();
  const value = new Date(`${date}T00:00:00.000Z`).getTime();
  if (end <= start) return 0.5;
  const clamped = Math.min(Math.max(value, start), end);
  return (clamped - start) / (end - start);
}

function dateAtPosition(
  position: number,
  bounds: { firstEligibleDate: string; today: string },
  viewport: RailViewport,
): string {
  const start = new Date(`${viewport.startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${viewport.endDate}T00:00:00.000Z`).getTime();
  const clamped = Math.min(Math.max(position, 0), 1);
  if (end <= start) return viewport.startDate;
  const date = new Date(start + (end - start) * clamped)
    .toISOString()
    .slice(0, 10);
  return dateForRailPosition({
    position: railPositionWithinBounds(date, bounds),
    ...bounds,
  });
}

function railPositionWithinBounds(
  date: string,
  bounds: { firstEligibleDate: string; today: string },
): number {
  const lower = new Date(`${bounds.firstEligibleDate}T00:00:00.000Z`).getTime();
  const upper = new Date(`${bounds.today}T00:00:00.000Z`).getTime();
  const value = new Date(`${date}T00:00:00.000Z`).getTime();
  return upper <= lower ? 0 : (value - lower) / (upper - lower);
}

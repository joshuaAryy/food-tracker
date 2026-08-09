import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import {
  macroSegments,
  stackedMacroSegments,
  type MacroKey,
} from '@/lib/analytics/macro-geometry';
import { ChartFrame } from './chart-frame';

const macroColors: Record<MacroKey, string> = {
  protein: '#C9242D',
  carbs: '#33B866',
  fat: '#FFAD8F',
};

export function MacroChart({
  values,
  size = 180,
  variant = 'donut',
  accessibilityLabel,
}: {
  values: Record<MacroKey, number | null>;
  size?: number;
  variant?: 'donut' | 'stacked_bar';
  accessibilityLabel: string;
}) {
  const segments = useMemo(() => macroSegments(values), [values]);
  const stackedSegments = useMemo(() => stackedMacroSegments(values), [values]);
  const radius = size * 0.34;
  const circumference = 2 * Math.PI * radius;
  const stackedTotal = stackedSegments.at(-1)?.end ?? 0;
  if (variant === 'stacked_bar') {
    return (
      <ChartFrame accessibilityLabel={accessibilityLabel}>
        <View>
          <Svg
            width={size}
            height={size * 0.34}
            viewBox={`0 0 ${size} ${size * 0.34}`}
          >
            {stackedSegments.map((segment) => (
              <Rect
                key={segment.key}
                x={
                  stackedTotal === 0 ? 0 : (segment.start / stackedTotal) * size
                }
                y={0}
                width={
                  stackedTotal === 0 ? 0 : (segment.value / stackedTotal) * size
                }
                height={size * 0.34}
                fill={macroColors[segment.key]}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            ))}
          </Svg>
        </View>
      </ChartFrame>
    );
  }
  let offset = 0;
  return (
    <ChartFrame accessibilityLabel={accessibilityLabel}>
      <View>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.map((segment) => {
            const length = circumference * segment.fraction;
            const circle = (
              <Circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={macroColors[segment.key]}
                strokeWidth={size * 0.2}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                rotation="-90"
                origin={`${size / 2}, ${size / 2}`}
              />
            );
            offset += length;
            return circle;
          })}
        </Svg>
      </View>
    </ChartFrame>
  );
}

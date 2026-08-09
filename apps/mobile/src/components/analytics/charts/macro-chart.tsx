import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { macroSegments, type MacroKey } from '@/lib/analytics/macro-geometry';
import { ChartFrame } from './chart-frame';

const macroColors: Record<MacroKey, string> = {
  protein: '#C9242D',
  carbs: '#33B866',
  fat: '#FFAD8F',
};

export function MacroChart({
  values,
  size = 180,
  accessibilityLabel,
}: {
  values: Record<MacroKey, number | null>;
  size?: number;
  accessibilityLabel: string;
}) {
  const segments = useMemo(() => macroSegments(values), [values]);
  const radius = size * 0.34;
  const circumference = 2 * Math.PI * radius;
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

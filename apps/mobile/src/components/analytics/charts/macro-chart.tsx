import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { AppText } from '@/components/app-text';
import {
  macroColors,
  macroDonutGeometry,
  macroSegments,
  macroSeparatorLines,
  stackedMacroSegments,
  type MacroKey,
} from '@/lib/analytics/macro-geometry';
import { ChartFrame } from './chart-frame';

export function MacroChart({
  values,
  size = 180,
  variant = 'donut',
  centerValue,
  centerLabel,
  accessibilityLabel,
}: {
  values: Record<MacroKey, number | null>;
  size?: number;
  variant?: 'donut' | 'stacked_bar';
  centerValue?: string | undefined;
  centerLabel?: string | undefined;
  accessibilityLabel: string;
}) {
  const segments = useMemo(() => macroSegments(values), [values]);
  const stackedSegments = useMemo(() => stackedMacroSegments(values), [values]);
  const geometry = useMemo(() => macroDonutGeometry(size), [size]);
  const separatorLines = useMemo(
    () =>
      macroSeparatorLines(
        segments,
        size,
        geometry.radius,
        geometry.strokeWidth,
      ),
    [geometry.radius, geometry.strokeWidth, segments, size],
  );
  const centerValueSize = size >= 112 ? 22 : 14;
  const centerLabelSize = size >= 112 ? 12 : 10;
  const circumference = 2 * Math.PI * geometry.radius;
  const stackedTotal = stackedSegments.at(-1)?.end ?? 0;
  if (variant === 'stacked_bar') {
    return (
      <ChartFrame accessibilityLabel={accessibilityLabel}>
        <View>
          <Svg
            testID="macro-donut-svg"
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
      <View
        testID="macro-donut-svg"
        className="relative"
        style={{
          width: size,
          height: size,
          shadowColor: '#7A9B76',
          shadowOpacity: 0.28,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            testID="macro-donut-halo"
            cx={size / 2}
            cy={size / 2}
            r={geometry.radius + size * 0.14}
            fill="#F3F4EF"
            opacity={0.9}
          />
          {segments.map((segment) => {
            const length = circumference * segment.fraction;
            const circle = (
              <Circle
                key={segment.key}
                testID={`macro-donut-segment-${segment.key}`}
                cx={size / 2}
                cy={size / 2}
                r={geometry.radius}
                fill="none"
                stroke={macroColors[segment.key]}
                strokeWidth={geometry.strokeWidth}
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
          {separatorLines.map((separator, index) => (
            <Line
              key={index}
              testID="macro-donut-separator"
              {...separator}
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}
          <Circle
            testID="macro-donut-center-disc"
            cx={size / 2}
            cy={size / 2}
            r={geometry.centerRadius}
            fill="#FFFFFF"
          />
        </Svg>
        {centerValue === undefined && centerLabel === undefined ? null : (
          <View
            testID="macro-donut-center"
            pointerEvents="none"
            className="absolute items-center justify-center self-center"
            style={{
              left: geometry.centerLabelBounds.x,
              top: geometry.centerLabelBounds.y,
              width: geometry.centerLabelBounds.width,
              height: geometry.centerLabelBounds.height,
              paddingHorizontal: 2,
            }}
          >
            {centerValue === undefined ? null : (
              <AppText
                variant="label"
                className="w-full text-center text-[20px] leading-6 tabular-nums"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{
                  fontSize: centerValueSize,
                  lineHeight: centerValueSize + 2,
                }}
              >
                {centerValue}
              </AppText>
            )}
            {centerLabel === undefined ? null : (
              <AppText
                variant="caption"
                className="text-center text-muted"
                style={{
                  fontSize: centerLabelSize,
                  lineHeight: centerLabelSize + 2,
                }}
              >
                {centerLabel}
              </AppText>
            )}
          </View>
        )}
      </View>
    </ChartFrame>
  );
}

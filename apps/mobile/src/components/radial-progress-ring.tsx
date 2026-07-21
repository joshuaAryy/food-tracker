import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { clamp } from '@/lib/streak-calendar-ui';
import { colors } from '@/theme/tokens';

interface RadialProgressRingProps extends PropsWithChildren {
  progress: number;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  trackDasharray?: string | number[];
  progressColor?: string;
  charcoalFraction?: number;
  charcoalColor?: string;
  accessibilityLabel?: string;
  testID?: string;
}

export function RadialProgressRing({
  children,
  progress,
  size = 72,
  strokeWidth = 7,
  trackColor = colors.light.primarySoft,
  trackDasharray,
  progressColor = colors.light.sageDark,
  charcoalFraction = 0,
  charcoalColor = colors.light.ink,
  accessibilityLabel,
  testID,
}: RadialProgressRingProps) {
  const normalizedProgress = clamp(progress);
  const normalizedCharcoal = clamp(charcoalFraction);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressLength = circumference * normalizedProgress;
  const charcoalLength = progressLength * normalizedCharcoal;
  const charcoalOffset = circumference - (progressLength - charcoalLength);

  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      className="items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        pointerEvents="none"
        accessibilityElementsHidden
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          {...(trackDasharray === undefined
            ? {}
            : { strokeDasharray: trackDasharray })}
        />
        {normalizedProgress > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={progressColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${progressLength} ${circumference}`}
            strokeDashoffset={0}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        ) : null}
        {charcoalLength > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={charcoalColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${charcoalLength} ${circumference}`}
            strokeDashoffset={charcoalOffset}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        ) : null}
      </Svg>
      <View className="absolute items-center justify-center">{children}</View>
    </View>
  );
}

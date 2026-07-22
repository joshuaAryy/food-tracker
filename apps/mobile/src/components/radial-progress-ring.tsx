import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
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
  centerColor?: string;
  goldGradient?: boolean;
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
  centerColor = colors.light.surface,
  goldGradient = false,
  accessibilityLabel,
  testID,
}: RadialProgressRingProps) {
  const normalizedProgress = clamp(progress);
  const normalizedCharcoal = clamp(charcoalFraction);
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const centerRadius = Math.max(radius - strokeWidth / 2, 0);
  const circumference = 2 * Math.PI * radius;
  const progressLength = circumference * normalizedProgress;
  const charcoalLength = progressLength * normalizedCharcoal;
  const charcoalOffset = circumference - progressLength + charcoalLength;
  const progressStroke = goldGradient
    ? 'url(#radial-progress-gold)'
    : progressColor;

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
        {goldGradient ? (
          <Defs>
            <LinearGradient
              id="radial-progress-gold"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <Stop offset="0" stopColor="#F5E9B9" />
              <Stop offset="0.45" stopColor="#D8B75D" />
              <Stop offset="1" stopColor="#B58C32" />
            </LinearGradient>
          </Defs>
        ) : null}
        <Circle cx={center} cy={center} r={centerRadius} fill={centerColor} />
        <Circle
          cx={center}
          cy={center}
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
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={progressStroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${progressLength} ${circumference}`}
            strokeDashoffset={0}
            rotation={-90}
            origin={`${center}, ${center}`}
          />
        ) : null}
        {charcoalLength > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={charcoalColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${charcoalLength} ${circumference}`}
            strokeDashoffset={charcoalOffset}
            rotation={-90}
            origin={`${center}, ${center}`}
          />
        ) : null}
      </Svg>
      <View className="absolute items-center justify-center">{children}</View>
    </View>
  );
}

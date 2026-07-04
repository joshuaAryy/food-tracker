import type { ComponentProps } from 'react';
import {
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface SkeletonBlockProps extends ComponentProps<typeof View> {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonBlock({
  width = '100%',
  height = 12,
  radius = 999,
  className = '',
  style,
  ...props
}: SkeletonBlockProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`bg-[#F0F0ED] ${className}`}
      style={[
        {
          width,
          height,
          borderRadius: radius,
          overflow: 'hidden',
          opacity: 0.96,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function SkeletonLine({
  width = '100%',
  height = 10,
  ...props
}: SkeletonBlockProps) {
  return <SkeletonBlock width={width} height={height} {...props} />;
}

export function SkeletonPill({
  width = 92,
  height = 30,
  ...props
}: SkeletonBlockProps) {
  return <SkeletonBlock width={width} height={height} {...props} />;
}

export function SkeletonRail({
  width = '100%',
  height = 10,
  ...props
}: SkeletonBlockProps) {
  return <SkeletonBlock width={width} height={height} {...props} />;
}

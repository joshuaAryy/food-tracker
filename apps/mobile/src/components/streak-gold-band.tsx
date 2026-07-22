import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { DAY_CELL_SIZE, DAY_RING_SIZE } from '@/lib/streak-calendar-ui';

type StreakGoldBandVariant = 'day' | 'week';

interface StreakGoldBandProps extends PropsWithChildren {
  variant: StreakGoldBandVariant;
  size?: number;
}

const WEEK_BAND_HEIGHT = 58;

export function StreakGoldBand({
  children,
  variant,
  size = DAY_RING_SIZE,
}: StreakGoldBandProps) {
  const isWeek = variant === 'week';
  const width = isWeek ? DAY_CELL_SIZE * 7 : size;
  const height = isWeek ? WEEK_BAND_HEIGHT : size;
  const visualTop = isWeek ? 5 : 0;

  return (
    <View style={{ width, height }}>
      <Svg
        width={width}
        height={size}
        viewBox={`0 0 ${width} ${size}`}
        pointerEvents="none"
        style={{ position: 'absolute', top: visualTop, left: 0 }}
      >
        <Defs>
          <LinearGradient id="streak-gold-base" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F4E6B1" />
            <Stop offset="0.35" stopColor="#D7B457" />
            <Stop offset="0.7" stopColor="#B48D32" />
            <Stop offset="1" stopColor="#E5CB7B" />
          </LinearGradient>
          <LinearGradient id="streak-gold-specular" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.56" />
            <Stop offset="0.38" stopColor="#FFF7D9" stopOpacity="0.14" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect
          x="0.5"
          y="0.5"
          width={width - 1}
          height={size - 1}
          rx={size / 2}
          fill="url(#streak-gold-base)"
          stroke="#A77F25"
          strokeOpacity="0.42"
        />
        <Rect
          x="1.5"
          y="1.5"
          width={width - 3}
          height={Math.max(size * 0.48, 1)}
          rx={size / 2}
          fill="url(#streak-gold-specular)"
        />
      </Svg>
      {children === undefined ? null : (
        <View
          className={isWeek ? 'flex-row' : 'items-center justify-center'}
          style={{ width, height }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

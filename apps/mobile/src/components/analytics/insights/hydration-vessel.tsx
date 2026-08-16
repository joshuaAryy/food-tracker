import { View } from 'react-native';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';
import { hydrationVesselVisual } from '@/lib/analytics/overview-visuals';

const VIEWBOX_WIDTH = 24;
const VIEWBOX_HEIGHT = 42;
const INNER_TOP = 5;
const INNER_BOTTOM = 38;

export function HydrationVessel({
  fill,
  index,
  compact = false,
}: {
  fill: number | null;
  index: number;
  compact?: boolean;
}) {
  const visual = hydrationVesselVisual(fill);
  const clipId = `hydration-vessel-clip-${index}`;
  const fillHeight = (INNER_BOTTOM - INNER_TOP) * (fill ?? 0);
  return (
    <View
      testID={`hydration-vessel-${index}`}
      style={{
        width: compact ? 20 : 24,
        height: compact ? 36 : VIEWBOX_HEIGHT,
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Defs>
          <ClipPath id={clipId}>
            <Path d="M4 5H20L17.8 38H6.2L4 5Z" />
          </ClipPath>
        </Defs>
        <Path
          d="M2.5 3.5H21.5L19 39H5L2.5 3.5Z"
          fill={visual.trackColor}
          stroke={visual.outline}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        {fill === null || fill <= 0 ? null : (
          <Rect
            x={0}
            y={INNER_BOTTOM - fillHeight}
            width={VIEWBOX_WIDTH}
            height={fillHeight}
            fill={visual.fillColor}
            clipPath={`url(#${clipId})`}
          />
        )}
      </Svg>
    </View>
  );
}

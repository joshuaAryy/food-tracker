import { Image, View } from 'react-native';
import compactInnerFlame from '@/assets/reporting/flame/compact-inner-flame.png';
import crimsonDepth from '@/assets/reporting/flame/crimson-depth.png';
import orangeInnerHeat from '@/assets/reporting/flame/orange-inner-heat.png';
import outerFlameBody from '@/assets/reporting/flame/outer-flame-body.png';
import yellowHeatAccent from '@/assets/reporting/flame/yellow-heat-accent.png';

interface StreakFlameProps {
  size?: number;
}

const flameLayers = [
  outerFlameBody,
  crimsonDepth,
  orangeInnerHeat,
  yellowHeatAccent,
  compactInnerFlame,
];

export function StreakFlame({ size = 48 }: StreakFlameProps) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: size, height: size }}
    >
      {flameLayers.map((source, index) => (
        <Image
          key={index}
          source={source}
          accessible={false}
          style={{ position: 'absolute', width: size, height: size }}
        />
      ))}
    </View>
  );
}

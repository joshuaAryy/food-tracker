import { Image, View } from 'react-native';
import graceLaurel from '@/assets/reporting/grace-laurel.png';

interface GraceLaurelIconProps {
  size?: number;
}

export function GraceLaurelIcon({ size = 44 }: GraceLaurelIconProps) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      className="items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Image
        source={graceLaurel}
        accessible={false}
        style={{ width: size, height: size }}
      />
    </View>
  );
}

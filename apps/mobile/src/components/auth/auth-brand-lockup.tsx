import { Image, View } from 'react-native';
import simpleLogo from '@/assets/brand/mode-icon-simple-closed.png';
import { AppText } from '../app-text';

interface AuthBrandLockupProps {
  className?: string;
}

export function AuthBrandLockup({ className = '' }: AuthBrandLockupProps) {
  return (
    <View className={`flex-row items-center gap-2 ${className}`}>
      <Image
        accessibilityLabel="Food Tracker"
        accessibilityRole="image"
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={simpleLogo}
        style={{ height: 30, width: 46 }}
      />
      <AppText variant="label" className="text-[15px] leading-5">
        Food Tracker
      </AppText>
    </View>
  );
}

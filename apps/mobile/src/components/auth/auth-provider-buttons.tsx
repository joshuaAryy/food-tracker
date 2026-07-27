import { Image, Pressable, View } from 'react-native';
import appleIcon from '@/assets/brand/auth-apple.png';
import googleIcon from '@/assets/brand/auth-google.png';
import { AppText } from '../app-text';

interface AuthProviderButtonsProps {
  onApple: () => void;
  onGoogle: () => void;
  disabled?: boolean;
}

export function AuthProviderButtons({
  onApple,
  onGoogle,
  disabled = false,
}: AuthProviderButtonsProps) {
  return (
    <View className="gap-3">
      <Pressable
        accessibilityLabel="Continue with Apple"
        accessibilityRole="button"
        className="h-[54px] flex-row items-center justify-center gap-2.5 rounded-[17px] bg-[#0E0E0E] active:opacity-75"
        disabled={disabled}
        onPress={onApple}
      >
        <Image
          accessibilityIgnoresInvertColors
          source={appleIcon}
          style={{ height: 22, width: 22 }}
        />
        <AppText variant="label" className="text-[15px] leading-5 text-white">
          Continue with Apple
        </AppText>
      </Pressable>
      <Pressable
        accessibilityLabel="Continue with Google"
        accessibilityRole="button"
        className="h-[54px] flex-row items-center justify-center gap-2.5 rounded-[17px] border border-[#E0E0DB] bg-white active:opacity-75"
        disabled={disabled}
        onPress={onGoogle}
      >
        <Image
          accessibilityIgnoresInvertColors
          source={googleIcon}
          style={{ height: 22, width: 22 }}
        />
        <AppText variant="label" className="text-[15px] leading-5">
          Continue with Google
        </AppText>
      </Pressable>
      <View className="h-5 flex-row items-center justify-center gap-3">
        <View className="h-px flex-1 bg-[#E0E0DB]" />
        <AppText variant="caption" className="text-[#6E6E6E]">
          or
        </AppText>
        <View className="h-px flex-1 bg-[#E0E0DB]" />
      </View>
    </View>
  );
}

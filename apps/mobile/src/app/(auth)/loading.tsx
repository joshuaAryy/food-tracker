import { ActivityIndicator, View } from 'react-native';
import { AuthBrandLockup } from '@/components/auth/auth-brand-lockup';
import { AuthShell } from '@/components/auth/auth-shell';
import { AppText } from '@/components/app-text';

export function AuthLoadingScreen() {
  return (
    <AuthShell>
      <View className="flex-1 items-center bg-white px-5 pt-44">
        <AuthBrandLockup />
        <View className="mt-32 items-center gap-5">
          <View className="flex-row gap-2">
            <View className="h-3 w-3 rounded-full bg-[#0E0E0E]" />
            <View className="h-3 w-3 rounded-full bg-[#E0E0DB]" />
            <View className="h-3 w-3 rounded-full bg-[#E0E0DB]" />
          </View>
          <AppText variant="heading" className="text-[24px] leading-8">
            Signing you in…
          </AppText>
          <AppText className="text-center text-[14px] leading-[19px] text-[#6E6E6E]">
            Restoring your secure session and account data.
          </AppText>
          <ActivityIndicator color="#0E0E0E" />
        </View>
      </View>
    </AuthShell>
  );
}

export default function AuthLoadingRoute() {
  return <AuthLoadingScreen />;
}

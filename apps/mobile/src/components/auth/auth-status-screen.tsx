import {
  CircleCheck,
  Mail,
  TriangleAlert,
  UserRoundCog,
} from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from '@/theme/tokens';
import { AppButton } from '../app-button';
import { AppText } from '../app-text';
import { AuthBrandLockup } from './auth-brand-lockup';

type AuthStatusIcon = 'success' | 'mail' | 'warning' | 'account';

interface AuthStatusScreenProps {
  icon: AuthStatusIcon;
  title: string;
  message: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimaryPress: () => void;
  onSecondaryPress?: () => void;
}

export function AuthStatusScreen({
  icon,
  title,
  message,
  primaryLabel,
  secondaryLabel,
  onPrimaryPress,
  onSecondaryPress,
}: AuthStatusScreenProps) {
  const Icon =
    icon === 'success'
      ? CircleCheck
      : icon === 'mail'
        ? Mail
        : icon === 'warning'
          ? TriangleAlert
          : UserRoundCog;
  const iconColor = icon === 'warning' ? '#FF1226' : '#0E7A43';
  const iconSurface = icon === 'warning' ? '#FFF0F2' : '#E8F7EF';

  return (
    <View className="flex-1 gap-6 bg-white px-5 pb-8 pt-16">
      <AuthBrandLockup />
      <View className="mt-12 gap-5">
        <View
          accessibilityLabel={`${title} status`}
          className="h-16 w-16 items-center justify-center rounded-[20px]"
          style={{ backgroundColor: iconSurface }}
        >
          <Icon color={iconColor} size={28} strokeWidth={2.2} />
        </View>
        <View className="gap-3">
          <AppText variant="title" className="text-[32px] leading-[39px]">
            {title}
          </AppText>
          <AppText className="text-[15px] leading-5 text-[#6E6E6E]">
            {message}
          </AppText>
        </View>
      </View>
      <View className="mt-7 gap-3">
        <AppButton
          className="h-[54px] rounded-[17px] border-[#0E0E0E]"
          onPress={onPrimaryPress}
        >
          {primaryLabel}
        </AppButton>
        {secondaryLabel === undefined ||
        onSecondaryPress === undefined ? null : (
          <AppButton
            variant="secondary"
            className="h-[54px] rounded-[17px] border border-[#E0E0DB] bg-white"
            onPress={onSecondaryPress}
          >
            {secondaryLabel}
          </AppButton>
        )}
      </View>
      <View className="flex-1" />
      <View style={{ backgroundColor: colors.light.canvas }} />
    </View>
  );
}

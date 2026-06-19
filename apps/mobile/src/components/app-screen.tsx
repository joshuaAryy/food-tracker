import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';

interface AppScreenProps extends PropsWithChildren {
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: (() => void) | undefined;
  footer?: ReactNode;
  contentClassName?: string;
  contentStyle?: StyleProp<ViewStyle>;
}

export function AppScreen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  footer,
  contentClassName = '',
  contentStyle,
}: AppScreenProps) {
  const content = (
    <View
      className={`w-full self-center gap-5 px-4 pb-28 pt-3 ${contentClassName}`}
      style={[{ maxWidth: 480 }, contentStyle]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            className="flex-1"
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh === undefined ? undefined : (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.light.primaryDark}
                />
              )
            }
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
        {footer === undefined ? null : (
          <View className="border-t border-border bg-surface-raised/95 px-4 py-3">
            <View className="w-full max-w-[480px] self-center">{footer}</View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

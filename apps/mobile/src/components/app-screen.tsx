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
  backgroundColor?: string;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
}

export function AppScreen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  footer,
  contentClassName = '',
  contentStyle,
  backgroundColor = colors.light.canvas,
  keyboardShouldPersistTaps = 'handled',
}: AppScreenProps) {
  const content = (
    <View
      className={`w-full self-center gap-6 px-5 pb-28 pt-4 ${contentClassName}`}
      style={[{ maxWidth: 480 }, contentStyle]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      className="flex-1"
      edges={['top']}
      style={{ backgroundColor }}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            className="flex-1"
            style={{ backgroundColor }}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps={keyboardShouldPersistTaps}
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
          <View className="px-5 py-3" style={{ backgroundColor }}>
            <View className="w-full max-w-[480px] self-center">{footer}</View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

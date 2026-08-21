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
  presentation?: 'default' | 'bottom-sheet';
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: (() => void) | undefined;
  footer?: ReactNode;
  contentClassName?: string;
  contentStyle?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  testID?: string;
}

export function AppScreen({
  children,
  presentation = 'default',
  scroll = true,
  refreshing = false,
  onRefresh,
  footer,
  contentClassName = '',
  contentStyle,
  backgroundColor = colors.light.canvas,
  keyboardShouldPersistTaps = 'handled',
  testID,
}: AppScreenProps) {
  const isBottomSheet = presentation === 'bottom-sheet';
  const content = (
    <View
      className={`w-full self-center gap-6 px-5 ${isBottomSheet ? 'flex-grow pb-4 pt-4' : 'pb-28 pt-4'} ${contentClassName}`}
      style={[{ maxWidth: 480, backgroundColor }, contentStyle]}
    >
      {children}
    </View>
  );
  const footerContent =
    footer === undefined ? null : (
      <View className="px-5 py-3" style={{ backgroundColor }}>
        <View className="w-full max-w-[480px] self-center">{footer}</View>
      </View>
    );
  const screenContent = isBottomSheet ? (
    <View
      className="w-full self-end overflow-hidden rounded-t-[28px]"
      style={{
        minHeight: '82%',
        maxWidth: 480,
        backgroundColor,
      }}
    >
      {content}
      {footerContent}
    </View>
  ) : (
    content
  );

  return (
    <SafeAreaView
      className="flex-1"
      edges={isBottomSheet ? [] : ['top']}
      style={{
        backgroundColor: isBottomSheet
          ? 'rgba(0, 0, 0, 0.24)'
          : backgroundColor,
      }}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            testID={testID}
            className="flex-1"
            style={{
              backgroundColor: isBottomSheet ? 'transparent' : backgroundColor,
            }}
            contentContainerStyle={
              isBottomSheet
                ? [
                    { backgroundColor: 'transparent' },
                    { flexGrow: 1, justifyContent: 'flex-end' },
                  ]
                : { backgroundColor }
            }
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
            {screenContent}
          </ScrollView>
        ) : (
          <View className={isBottomSheet ? 'flex-1 justify-end' : ''}>
            {screenContent}
          </View>
        )}
        {isBottomSheet ? null : footerContent}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

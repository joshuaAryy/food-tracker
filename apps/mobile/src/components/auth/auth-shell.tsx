import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function AuthShell({ children }: PropsWithChildren) {
  return (
    <SafeAreaView className="flex-1 bg-[#F4F4F1]" edges={['top', 'bottom']}>
      <View className="w-full max-w-[390px] flex-1 self-center overflow-hidden rounded-[28px] bg-white shadow-lg">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            className="flex-1 bg-white"
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

import { forwardRef } from 'react';
import type { ComponentProps } from 'react';
import { TextInput, View } from 'react-native';
import { AppText } from '../app-text';

interface AuthFormFieldProps extends ComponentProps<typeof TextInput> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

export const AuthFormField = forwardRef<TextInput, AuthFormFieldProps>(
  ({ label, error, hint, className = '', ...props }, ref) => (
    <View className="gap-[7px]">
      <AppText variant="label" className="text-[13px] leading-[18px]">
        {label}
      </AppText>
      <TextInput
        ref={ref}
        accessibilityHint={error}
        accessibilityLabel={label}
        className={`h-[54px] rounded-[16px] border bg-white px-[15px] text-[15px] leading-5 text-ink ${
          error === undefined ? 'border-[#E0E0DB]' : 'border-red-500'
        } ${className}`}
        placeholderTextColor="#6E6E6E"
        {...props}
      />
      {hint === undefined || error !== undefined ? null : (
        <AppText variant="caption" className="text-[#6E6E6E]">
          {hint}
        </AppText>
      )}
      {error === undefined ? null : (
        <AppText
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          variant="caption"
          className="text-red-500"
        >
          {error}
        </AppText>
      )}
    </View>
  ),
);

AuthFormField.displayName = 'AuthFormField';

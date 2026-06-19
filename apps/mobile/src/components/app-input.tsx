import { forwardRef } from 'react';
import type { ComponentProps } from 'react';
import { TextInput, View } from 'react-native';
import { AppText } from './app-text';

interface AppInputProps extends ComponentProps<typeof TextInput> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
}

export const AppInput = forwardRef<TextInput, AppInputProps>(
  (
    { label, error, hint, className = '', multiline, numberOfLines, ...props },
    ref,
  ) => (
    <View className="gap-1.5">
      <AppText variant="label">{label}</AppText>
      <TextInput
        ref={ref}
        className={`min-h-[46px] rounded-control border bg-surface px-3.5 py-2.5 text-base text-ink ${
          error === undefined ? 'border-border' : 'border-error'
        } ${multiline ? 'min-h-20 text-top' : ''} ${className}`}
        multiline={multiline}
        numberOfLines={numberOfLines}
        placeholderTextColor="#8B8A81"
        {...props}
      />
      {error !== undefined ? (
        <AppText variant="caption" className="text-error">
          {error}
        </AppText>
      ) : hint !== undefined ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  ),
);

AppInput.displayName = 'AppInput';

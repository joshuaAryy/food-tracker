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
  ) => {
    const inputStyle = multiline
      ? {
          minHeight: 88,
          paddingTop: 12,
          paddingBottom: 12,
          fontSize: 16,
          lineHeight: 22,
          textAlignVertical: 'top' as const,
        }
      : {
          height: 48,
          paddingTop: 0,
          paddingBottom: 0,
          fontSize: 16,
          lineHeight: 20,
          includeFontPadding: false,
          textAlignVertical: 'center' as const,
        };

    return (
      <View className="gap-1.5">
        <AppText variant="label">{label}</AppText>
        <TextInput
          ref={ref}
          className={`rounded-control border bg-surface px-3.5 text-ink ${
            error === undefined ? 'border-border' : 'border-error'
          } ${className}`}
          multiline={multiline}
          numberOfLines={numberOfLines}
          placeholderTextColor="#8B8A81"
          style={inputStyle}
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
    );
  },
);

AppInput.displayName = 'AppInput';

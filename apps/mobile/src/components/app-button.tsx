import type { ComponentProps, PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { AppText } from './app-text';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface AppButtonProps
  extends
    PropsWithChildren,
    Omit<ComponentProps<typeof Pressable>, 'children'> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary border-primary',
  secondary: 'bg-module border-transparent',
  ghost: 'bg-transparent border-transparent',
  danger: 'bg-error border-error',
};

export function AppButton({
  children,
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  ...props
}: AppButtonProps) {
  const isDisabled = disabled === true || loading;
  const lightText = variant === 'primary' || variant === 'danger';
  const disabledClasses =
    isDisabled && variant === 'primary'
      ? 'bg-primary-soft border-primary-soft'
      : isDisabled
        ? 'opacity-45'
        : 'active:opacity-75';
  const textClass =
    isDisabled && variant === 'primary'
      ? 'text-muted'
      : lightText
        ? 'text-surface-raised'
        : 'text-primary-dark';

  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-[52px] items-center justify-center rounded-full border px-6 py-3 ${
        variantClasses[variant]
      } ${disabledClasses} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={lightText ? '#FFFCF5' : '#0F110E'} />
      ) : (
        <AppText variant="label" className={textClass}>
          {children}
        </AppText>
      )}
    </Pressable>
  );
}

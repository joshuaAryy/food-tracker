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
  primary: 'bg-sage border-sage',
  secondary: 'bg-surface-raised border-border',
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

  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-[46px] items-center justify-center rounded-control border px-5 py-2.5 ${
        variantClasses[variant]
      } ${isDisabled ? 'opacity-45' : 'active:opacity-75'} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={lightText ? '#FFFCF5' : '#506D4F'} />
      ) : (
        <AppText
          variant="label"
          className={lightText ? 'text-surface-raised' : 'text-sage-dark'}
        >
          {children}
        </AppText>
      )}
    </Pressable>
  );
}

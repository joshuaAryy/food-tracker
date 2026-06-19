import type { ComponentProps, PropsWithChildren } from 'react';
import { View } from 'react-native';

interface AppCardProps
  extends PropsWithChildren, Omit<ComponentProps<typeof View>, 'children'> {
  elevated?: boolean;
  compact?: boolean;
}

export function AppCard({
  children,
  elevated = false,
  compact = false,
  className = '',
  style,
  ...props
}: AppCardProps) {
  return (
    <View
      className={`rounded-app border border-border bg-surface-raised ${
        elevated ? 'shadow-sm shadow-ink/10' : ''
      } ${compact ? 'p-4' : 'p-[18px]'} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
}

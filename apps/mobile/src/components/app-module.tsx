import type { ComponentProps, PropsWithChildren } from 'react';
import { View } from 'react-native';

interface AppModuleProps
  extends PropsWithChildren, Omit<ComponentProps<typeof View>, 'children'> {
  padded?: boolean;
  tone?: 'default' | 'muted' | 'dark';
}

const toneClasses = {
  default: 'bg-module',
  muted: 'bg-module-muted',
  dark: 'bg-primary',
} as const;

export function AppModule({
  children,
  padded = true,
  tone = 'default',
  className = '',
  ...props
}: AppModuleProps) {
  return (
    <View
      className={`rounded-module ${toneClasses[tone]} ${
        padded ? 'p-5' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}

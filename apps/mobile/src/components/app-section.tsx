import type { PropsWithChildren, ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from './app-text';

interface AppSectionProps extends PropsWithChildren {
  title: string;
  description?: string | undefined;
  action?: ReactNode;
  className?: string | undefined;
}

export function AppSection({
  title,
  description,
  action,
  className = '',
  children,
}: AppSectionProps) {
  return (
    <View className={`gap-2.5 ${className}`}>
      <View className="flex-row items-end justify-between gap-3 px-1">
        <View className="min-w-0 flex-1 gap-0.5">
          <AppText variant="heading">{title}</AppText>
          {description === undefined ? null : (
            <AppText variant="caption" muted>
              {description}
            </AppText>
          )}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

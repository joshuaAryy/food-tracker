import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from './app-text';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string | undefined;
  eyebrow?: string | undefined;
  action?: ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  eyebrow,
  action,
}: ScreenHeaderProps) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <View className="min-w-0 flex-1 gap-1">
        {eyebrow === undefined ? null : (
          <AppText variant="caption" muted>
            {eyebrow}
          </AppText>
        )}
        <AppText variant="title">{title}</AppText>
        {subtitle === undefined ? null : <AppText muted>{subtitle}</AppText>}
      </View>
      {action}
    </View>
  );
}

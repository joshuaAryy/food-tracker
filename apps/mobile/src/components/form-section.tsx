import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { AppCard } from './app-card';
import { AppText } from './app-text';

interface FormSectionProps extends PropsWithChildren {
  title: string;
  description?: string | undefined;
}

export function FormSection({
  title,
  description,
  children,
}: FormSectionProps) {
  return (
    <AppCard compact className="gap-4">
      <View className="gap-0.5">
        <AppText variant="heading">{title}</AppText>
        {description === undefined ? null : (
          <AppText variant="caption" muted>
            {description}
          </AppText>
        )}
      </View>
      {children}
    </AppCard>
  );
}

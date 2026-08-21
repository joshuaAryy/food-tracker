import { View } from 'react-native';
import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';

export function TrendSummaryCard({
  title,
  caption,
  comparison,
  reference,
}: {
  title: string;
  caption: string;
  comparison?: string | undefined;
  reference?: string | undefined;
}) {
  return (
    <AppCard elevated className="gap-1 p-[18px]">
      <AppText variant="heading" className="text-[30px] leading-9 tabular-nums">
        {title}
      </AppText>
      <AppText variant="caption" className="text-muted">
        {caption}
      </AppText>
      {comparison === undefined ? null : (
        <AppText variant="caption" className="text-primary-dark">
          {comparison}
        </AppText>
      )}
      {reference === undefined ? null : (
        <View className="pt-1">
          <AppText variant="caption" className="text-muted">
            {reference}
          </AppText>
        </View>
      )}
    </AppCard>
  );
}

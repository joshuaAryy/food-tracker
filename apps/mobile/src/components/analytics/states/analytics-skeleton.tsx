import { View } from 'react-native';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import {
  SkeletonBlock,
  SkeletonLine,
  SkeletonPill,
} from '@/components/skeleton';

export function AnalyticsSkeleton({
  period = 'month',
}: {
  period?: 'week' | 'month';
}) {
  return (
    <AppScreen
      testID="analytics-skeleton"
      contentClassName="gap-[18px]"
      backgroundColor="#FFFFFF"
    >
      <AppText variant="title">Insights</AppText>
      <AppText variant="caption" className="text-muted">
        {period === 'week' ? 'Week' : 'Month'} · Loading analytics
      </AppText>
      <SkeletonPill width="100%" height={42} />
      <SkeletonBlock width="100%" height={154} radius={18} />
      <SkeletonLine width="60%" height={30} />
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          className="w-full gap-3 rounded-[18px] border border-border bg-white p-4"
        >
          <SkeletonLine width="45%" height={14} />
          <SkeletonLine width="58%" height={34} radius={9} />
          <SkeletonBlock width="100%" height={70} radius={12} />
          <SkeletonLine width="68%" height={14} />
        </View>
      ))}
    </AppScreen>
  );
}

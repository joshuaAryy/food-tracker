import type { PropsWithChildren } from 'react';
import { ScrollView, Text, View } from 'react-native';

interface PlaceholderScreenProps extends PropsWithChildren {
  title: string;
  description: string;
}

export function PlaceholderScreen({
  title,
  description,
  children,
}: PlaceholderScreenProps) {
  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="gap-4 px-6 py-10">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-slate-950">{title}</Text>
          <Text className="text-base leading-6 text-slate-600">
            {description}
          </Text>
        </View>
        <View className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
          <Text className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Phase 1 placeholder
          </Text>
          <Text className="mt-2 text-base text-slate-700">
            Feature behavior will be implemented in a later phase.
          </Text>
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

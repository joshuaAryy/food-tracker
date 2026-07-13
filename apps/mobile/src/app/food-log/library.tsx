import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { FoodLibrarySection, FoodLibraryItem } from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';

const sections: Array<{ key: FoodLibrarySection; label: string }> = [
  { key: 'saved', label: 'Saved' },
  { key: 'my_foods', label: 'My Foods' },
  { key: 'recent', label: 'Recent' },
  { key: 'archived', label: 'Archived' },
];

export default function FoodLibraryScreen() {
  const router = useRouter();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [section, setSection] = useState<FoodLibrarySection>('saved');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [items, setItems] = useState<FoodLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(
        (
          await api.foodItems.library({
            section,
            query: query.trim() || undefined,
            sort,
            limit: 50,
          })
        ).foodItems,
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [query, section, sort]);
  useEffect(() => {
    void load();
  }, [dataVersion, load]);
  return (
    <AppScreen
      refreshing={loading && items.length > 0}
      onRefresh={() => void load()}
      contentClassName="gap-4"
    >
      <ScreenHeader
        eyebrow="Food Log"
        title="Food Library"
        subtitle="Saved, personal, and recent foods."
        action={
          <Pressable onPress={() => router.back()}>
            <AppText variant="label">Close</AppText>
          </Pressable>
        }
      />
      <View className="flex-row flex-wrap gap-2">
        {sections.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setSection(item.key)}
            className={`rounded-full px-3 py-2 ${section === item.key ? 'bg-primary-dark' : 'bg-surface'}`}
          >
            <AppText
              variant="caption"
              className={section === item.key ? 'text-white' : 'text-ink'}
            >
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </View>
      <AppInput
        label="Search library"
        value={query}
        onChangeText={setQuery}
        placeholder="Search foods"
      />
      <AppButton
        onPress={() =>
          setSort((value) => (value === 'recent' ? 'name' : 'recent'))
        }
      >
        Sort: {sort === 'recent' ? 'Recent' : 'Name'}
      </AppButton>
      {section === 'my_foods' ? (
        <AppButton onPress={() => router.push('/food-log/manual-food')}>
          Create manual food
        </AppButton>
      ) : null}
      {loading && items.length === 0 ? (
        <LoadingState message="Loading food library…" />
      ) : null}
      {error !== null ? (
        <ErrorState
          title="Food Library unavailable"
          message={error}
          onRetry={() => void load()}
        />
      ) : null}
      {!loading && error === null && items.length === 0 ? (
        <EmptyState
          title={`No ${sections.find((item) => item.key === section)?.label.toLocaleLowerCase()} foods`}
          message="Try another search or add a food from Food Log."
        />
      ) : null}
      {items.map((food) => (
        <Pressable
          key={food.id}
          className="gap-1 border-b border-line py-3"
          onPress={() =>
            router.push(
              `/food-log/library-detail?id=${food.id}&archived=${food.archivedAt !== null}`,
            )
          }
        >
          <View className="flex-row justify-between">
            <AppText variant="label">{food.name}</AppText>
            <AppText variant="caption" muted>
              {food.calories ?? '—'} kcal
            </AppText>
          </View>
          <AppText variant="caption" muted>
            {food.isSaved ? 'Saved · ' : ''}
            {food.sourceProvider ?? 'trusted'} · {food.servingQuantity ?? '—'}{' '}
            {food.servingUnit ?? ''}
          </AppText>
        </Pressable>
      ))}
    </AppScreen>
  );
}

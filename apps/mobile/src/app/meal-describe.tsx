import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Search, Sparkles, X } from 'lucide-react-native';
import type {
  AiFoodParseCandidate,
  AiFoodParsedItem,
  AiFoodParseResult,
  AiFoodParseExternalFood,
  FoodItem,
  FoodLogsFromCandidatesInput,
  MealType,
} from '@food-tracker/shared';
import { MEAL_TYPES } from '@food-tracker/shared';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { ScreenHeader } from '@/components/screen-header';
import { ServingMultiplierControl } from '@/components/serving-multiplier-control';
import { api, errorMessage } from '@/lib/api-client';
import { colors } from '@/theme/tokens';

const examples = [
  '2 eggs, toast, banana',
  'rice bowl with chicken',
  'protein shake with milk',
] as const;

function nutrientPreview(
  food: FoodItem | AiFoodParseExternalFood,
  multiplier: string,
): string {
  const parsedMultiplier = Number(multiplier);
  const amount =
    Number.isFinite(parsedMultiplier) && parsedMultiplier > 0
      ? parsedMultiplier
      : 1;
  const parts = [
    food.calories === null
      ? null
      : `${Math.round(food.calories * amount)} kcal`,
    food.protein === null
      ? null
      : `${(food.protein * amount).toFixed(1)}g protein`,
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? 'Nutrition unknown' : parts.join(' / ');
}

function candidateId(candidate: AiFoodParseCandidate): string {
  return candidate.candidateType === 'food_item'
    ? candidate.foodItem.id
    : `${candidate.externalFood.sourceProvider}:${candidate.externalFood.sourceId}`;
}

function selectedCandidate(
  item: AiFoodParsedItem,
  selectedCandidateIds: Record<string, string>,
): AiFoodParseCandidate | null {
  const selectedCandidateId =
    selectedCandidateIds[item.id] ?? item.selectedCandidateId;
  const candidate = item.candidates.find(
    (value) => candidateId(value) === selectedCandidateId,
  );
  return candidate ?? item.candidates[0] ?? null;
}

function candidateFood(
  candidate: AiFoodParseCandidate | null,
): FoodItem | AiFoodParseExternalFood | null {
  if (candidate === null) return null;
  return candidate.candidateType === 'food_item'
    ? candidate.foodItem
    : candidate.externalFood;
}

function candidateMatchCopy(candidate: AiFoodParseCandidate): string {
  if (candidate.candidateType === 'external_food') {
    return `USDA match: ${candidate.externalFood.name} (${candidate.externalFood.servingBasisText})`;
  }

  return `Matched to ${candidate.foodItem.name}`;
}

function statusLabel(item: AiFoodParsedItem): string {
  if (item.reviewStatus === 'matched') return 'Matched';
  if (item.reviewStatus === 'needs_review') return 'Review';
  return 'Needs food';
}

function statusClasses(item: AiFoodParsedItem): string {
  if (item.reviewStatus === 'matched') return 'bg-sage-soft text-ink';
  if (item.reviewStatus === 'needs_review') return 'bg-carbs-soft text-ink';
  return 'bg-error-soft text-error';
}

function isCandidateLoggable(candidate: AiFoodParseCandidate | null): boolean {
  const food = candidateFood(candidate);
  return food !== null && food.calories !== null && food.protein !== null;
}

function MealTypePill({
  value,
  selected,
  onPress,
}: {
  value: MealType;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-full px-3.5 py-2 ${
        selected ? 'bg-primary' : 'bg-module'
      }`}
      onPress={onPress}
    >
      <AppText
        variant="caption"
        className={selected ? 'text-surface-raised' : 'text-ink'}
      >
        {value.slice(0, 1).toUpperCase()}
        {value.slice(1)}
      </AppText>
    </Pressable>
  );
}

export default function MealDescribeScreen() {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [result, setResult] = useState<AiFoodParseResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<
    Record<string, string>
  >({});
  const [removedRows, setRemovedRows] = useState<string[]>([]);
  const [multipliers, setMultipliers] = useState<Record<string, string>>({});
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleItems = useMemo(
    () =>
      result === null
        ? []
        : result.items.filter((item) => !removedRows.includes(item.id)),
    [removedRows, result],
  );
  const selectedLoggableCount = visibleItems.filter(
    (item) =>
      isCandidateLoggable(selectedCandidate(item, selectedCandidateIds)) &&
      selectedRows.includes(item.id),
  ).length;

  const parseMeal = async () => {
    const trimmed = description.trim();
    if (trimmed.length === 0) {
      setError('Describe the meal you want to log.');
      return;
    }

    setParsing(true);
    setError(null);
    try {
      const parsed = await api.ai.parseFood(trimmed);
      setResult(parsed);
      setRemovedRows([]);
      setSelectedRows(
        parsed.items.filter((item) => item.loggable).map((item) => item.id),
      );
      setSelectedCandidateIds(
        Object.fromEntries(
          parsed.items.flatMap((item) =>
            item.selectedCandidateId === null
              ? []
              : [[item.id, item.selectedCandidateId]],
          ),
        ),
      );
      setMultipliers(
        Object.fromEntries(
          parsed.items.map((item) => [
            item.id,
            String(item.candidates[0]?.defaultServingMultiplier ?? 1),
          ]),
        ),
      );
    } catch (parseError) {
      setError(errorMessage(parseError));
    } finally {
      setParsing(false);
    }
  };

  const logSelected = async () => {
    if (result === null || selectedLoggableCount === 0) return;

    setSaving(true);
    setError(null);
    try {
      const items = visibleItems.reduce<FoodLogsFromCandidatesInput['items']>(
        (selectedItems, item) => {
          const candidate = selectedCandidate(item, selectedCandidateIds);

          if (
            !isCandidateLoggable(candidate) ||
            !selectedRows.includes(item.id)
          ) {
            return selectedItems;
          }

          if (candidate === null) return selectedItems;

          if (candidate.candidateType === 'food_item') {
            selectedItems.push({
              candidateType: 'food_item',
              foodItemId: candidate.foodItem.id,
              servingMultiplier: Number(multipliers[item.id] ?? 1),
            });
            return selectedItems;
          }

          selectedItems.push({
            candidateType: 'external_food',
            sourceProvider: candidate.externalFood.sourceProvider,
            sourceId: candidate.externalFood.sourceId,
            servingMultiplier: Number(multipliers[item.id] ?? 1),
          });
          return selectedItems;
        },
        [],
      );

      await api.foodLogs.createFromCandidates({
        mealType,
        loggedAt: new Date().toISOString(),
        items,
      });
      router.back();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const toggleSelected = (item: AiFoodParsedItem) => {
    const candidate = selectedCandidate(item, selectedCandidateIds);
    if (!isCandidateLoggable(candidate)) return;
    setSelectedRows((current) =>
      current.includes(item.id)
        ? current.filter((id) => id !== item.id)
        : [...current, item.id],
    );
  };

  return (
    <AppScreen
      footer={
        result === null ? (
          <AppButton loading={parsing} onPress={parseMeal}>
            Read meal
          </AppButton>
        ) : (
          <AppButton
            disabled={selectedLoggableCount === 0}
            loading={saving}
            onPress={logSelected}
          >
            Log selected
          </AppButton>
        )
      }
    >
      <ScreenHeader
        title="Describe meal"
        subtitle="Turn a messy meal note into foods you can review before logging."
        action={
          <Pressable
            accessibilityRole="button"
            className="rounded-full bg-surface px-3.5 py-2"
            onPress={() => router.back()}
          >
            <AppText variant="label" className="text-sage-dark">
              Close
            </AppText>
          </Pressable>
        }
      />

      {error === null ? null : (
        <ErrorState title="Meal parsing needs attention" message={error} />
      )}

      {result === null ? (
        <View className="gap-5">
          <View className="gap-3 border-y border-line py-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
                <Sparkles
                  color={colors.light.ink}
                  size={18}
                  strokeWidth={2.3}
                />
              </View>
              <View className="min-w-0 flex-1 gap-0.5">
                <AppText variant="label">Messy thought, clean log</AppText>
                <AppText variant="caption" muted>
                  AI parses the text. Food data still comes from matched foods.
                </AppText>
              </View>
            </View>
            <AppInput
              label="Meal description"
              multiline
              numberOfLines={5}
              placeholder="2 eggs, toast with butter, and a banana"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View className="gap-2">
            <AppText variant="label">Try an example</AppText>
            <View className="flex-row flex-wrap gap-2">
              {examples.map((example) => (
                <Pressable
                  key={example}
                  accessibilityRole="button"
                  className="rounded-full bg-module px-3.5 py-2 active:bg-primary-soft"
                  onPress={() => setDescription(example)}
                >
                  <AppText variant="caption" className="text-ink">
                    {example}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>

          {parsing ? (
            <View className="flex-row items-center gap-3 border-t border-line pt-4">
              <ActivityIndicator color={colors.light.primaryDark} />
              <AppText variant="label">Reading your meal...</AppText>
            </View>
          ) : null}
        </View>
      ) : (
        <View className="gap-5">
          <View className="gap-2">
            <AppText variant="label">Meal type</AppText>
            <View className="flex-row flex-wrap gap-2">
              {MEAL_TYPES.map((value) => (
                <MealTypePill
                  key={value}
                  value={value}
                  selected={mealType === value}
                  onPress={() => setMealType(value)}
                />
              ))}
            </View>
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <AppText variant="heading">Review foods</AppText>
              <Pressable
                accessibilityRole="button"
                className="rounded-full bg-module px-3.5 py-2"
                onPress={() => setResult(null)}
              >
                <AppText variant="caption" className="text-ink">
                  Edit text
                </AppText>
              </Pressable>
            </View>

            <View className="border-y border-line">
              {visibleItems.map((item, index) => {
                const candidate = selectedCandidate(item, selectedCandidateIds);
                const food = candidateFood(candidate);
                const selected = selectedRows.includes(item.id);
                const loggable = isCandidateLoggable(candidate);

                return (
                  <View
                    key={item.id}
                    className={`gap-3 py-4 ${
                      index === 0 ? '' : 'border-t border-line'
                    }`}
                  >
                    <View className="flex-row items-start gap-3">
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        className={`mt-1 h-8 w-8 items-center justify-center rounded-full ${
                          selected && loggable
                            ? 'bg-primary'
                            : 'bg-module-muted'
                        }`}
                        disabled={!loggable}
                        onPress={() => toggleSelected(item)}
                      >
                        {selected && loggable ? (
                          <Check color="#FFFFFF" size={16} strokeWidth={2.4} />
                        ) : null}
                      </Pressable>

                      <View className="min-w-0 flex-1 gap-1">
                        <View className="flex-row items-center gap-2">
                          <AppText
                            variant="label"
                            className="min-w-0 flex-1"
                            numberOfLines={1}
                          >
                            {item.parsedName}
                          </AppText>
                          <View
                            className={`rounded-full px-2.5 py-1 ${statusClasses(
                              item,
                            )}`}
                          >
                            <AppText variant="caption">
                              {statusLabel(item)}
                            </AppText>
                          </View>
                        </View>

                        {food === null ? (
                          <View className="gap-2">
                            <AppText variant="caption" muted>
                              No matching food yet. Search or enter it manually
                              before logging this item.
                            </AppText>
                            <Pressable
                              accessibilityRole="button"
                              className="flex-row items-center gap-2 self-start rounded-full bg-module px-3.5 py-2"
                              onPress={() => router.replace('/food-log')}
                            >
                              <Search
                                color={colors.light.ink}
                                size={14}
                                strokeWidth={2.2}
                              />
                              <AppText variant="caption" className="text-ink">
                                Search manually
                              </AppText>
                            </Pressable>
                          </View>
                        ) : (
                          <View className="gap-2">
                            <AppText variant="caption" muted numberOfLines={1}>
                              {candidate === null
                                ? 'Matched food'
                                : candidateMatchCopy(candidate)}
                            </AppText>
                            <AppText variant="caption" className="text-ink">
                              {nutrientPreview(
                                food,
                                multipliers[item.id] ?? '1',
                              )}
                            </AppText>
                            <ServingMultiplierControl
                              value={multipliers[item.id] ?? '1'}
                              onChange={(value) =>
                                setMultipliers((current) => ({
                                  ...current,
                                  [item.id]: value,
                                }))
                              }
                            />
                            {item.candidates.length > 1 ? (
                              <View className="flex-row flex-wrap gap-2">
                                {item.candidates.map((candidateOption) => {
                                  const optionId = candidateId(candidateOption);
                                  const optionFood =
                                    candidateFood(candidateOption);
                                  const optionSelected =
                                    candidate !== null &&
                                    candidateId(candidate) === optionId;

                                  return (
                                    <Pressable
                                      key={optionId}
                                      accessibilityRole="button"
                                      accessibilityState={{
                                        selected: optionSelected,
                                      }}
                                      className={`rounded-full px-3 py-2 ${
                                        optionSelected
                                          ? 'bg-primary'
                                          : 'bg-module'
                                      }`}
                                      onPress={() => {
                                        setSelectedCandidateIds((current) => ({
                                          ...current,
                                          [item.id]: optionId,
                                        }));
                                        if (
                                          isCandidateLoggable(candidateOption)
                                        ) {
                                          setSelectedRows((current) =>
                                            current.includes(item.id)
                                              ? current
                                              : [...current, item.id],
                                          );
                                        }
                                      }}
                                    >
                                      <AppText
                                        variant="caption"
                                        className={
                                          optionSelected
                                            ? 'text-white'
                                            : 'text-ink'
                                        }
                                      >
                                        {optionFood?.name ?? 'Unmatched'}
                                      </AppText>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            ) : null}
                          </View>
                        )}
                      </View>

                      <Pressable
                        accessibilityLabel={`Remove ${item.parsedName}`}
                        accessibilityRole="button"
                        className="h-9 w-9 items-center justify-center rounded-full bg-module active:bg-primary-soft"
                        onPress={() =>
                          setRemovedRows((current) => [...current, item.id])
                        }
                      >
                        <X
                          color={colors.light.ink}
                          size={16}
                          strokeWidth={2.3}
                        />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>

            {visibleItems.length === 0 ? (
              <View className="gap-1 border-y border-line py-4">
                <AppText variant="label">No foods selected</AppText>
                <AppText variant="caption" muted>
                  Edit the description or return to manual logging.
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </AppScreen>
  );
}

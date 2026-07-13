import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SelectableOption } from '@/components/selectable-option';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';
import type { FoodItem, ManualFoodItemCreateInput } from '@food-tracker/shared';

type BasisMode = 'per_100g' | 'per_serving';
const numberOrNull = (value: string) =>
  value.trim() === '' ? undefined : Number(value);

export default function ManualFoodScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : null;
  const setResult = useAppStore((state) => state.setMixedMealManualResult);
  const [loaded, setLoaded] = useState<FoodItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [sodium, setSodium] = useState('');
  const [basisMode, setBasisMode] = useState<BasisMode>('per_100g');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('serving');
  const [equivalence, setEquivalence] = useState('');
  const [equivalenceUnit, setEquivalenceUnit] = useState<'g' | 'ml'>('g');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(id !== null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (id === null) return;
    void api.foodItems
      .getById(id)
      .then((food) => {
        setLoaded(food);
        setName(food.name);
        setDescription(food.description ?? '');
        setCalories(String(food.calories ?? ''));
        setProtein(String(food.protein ?? ''));
        setCarbs(String(food.carbs ?? ''));
        setFat(String(food.fat ?? ''));
        setFiber(food.fiber === null ? '' : String(food.fiber));
        setSugar(food.sugar === null ? '' : String(food.sugar));
        setSodium(food.sodium === null ? '' : String(food.sodium));
        setBasisMode(
          food.servingQuantity === 100 && food.servingUnit === 'g'
            ? 'per_100g'
            : 'per_serving',
        );
        setQuantity(String(food.servingQuantity ?? 1));
        setUnit(food.servingUnit ?? 'serving');
        const basisOption = food.servingOptions?.options.find(
          (option) =>
            option.quantity === food.servingQuantity &&
            option.unit === food.servingUnit,
        );
        if (
          basisOption?.equivalentWeightGrams !== null &&
          basisOption?.equivalentWeightGrams !== undefined
        ) {
          setEquivalence(String(basisOption.equivalentWeightGrams));
          setEquivalenceUnit('g');
        } else if (
          basisOption?.equivalentVolumeMl !== null &&
          basisOption?.equivalentVolumeMl !== undefined
        ) {
          setEquivalence(String(basisOption.equivalentVolumeMl));
          setEquivalenceUnit('ml');
        }
        setLoading(false);
      })
      .catch((cause) => {
        setError(errorMessage(cause));
        setLoading(false);
      });
  }, [id]);
  const save = async () => {
    const nutrition = {
      calories: Number(calories),
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
      fiber: numberOrNull(fiber),
      sugar: numberOrNull(sugar),
      sodium: numberOrNull(sodium),
    };
    const input: ManualFoodItemCreateInput = {
      name,
      description: description.trim() === '' ? null : description,
      basis:
        basisMode === 'per_100g'
          ? { mode: 'per_100g' }
          : {
              mode: 'per_serving',
              quantity: Number(quantity),
              unit: unit as ManualFoodItemCreateInput['basis'] extends infer T
                ? T extends { unit: infer U }
                  ? U
                  : never
                : never,
              ...(equivalence.trim() === ''
                ? {}
                : equivalenceUnit === 'g'
                  ? { equivalentWeightGrams: Number(equivalence) }
                  : { equivalentVolumeMl: Number(equivalence) }),
            },
      nutrition,
    };
    if (
      !name.trim() ||
      [calories, protein, carbs, fat].some(
        (value) => value.trim() === '' || Number(value) < 0,
      ) ||
      (basisMode === 'per_serving' &&
        (Number(quantity) <= 0 ||
          unit.trim() === '' ||
          (equivalence.trim() !== '' && Number(equivalence) <= 0)))
    ) {
      setError(
        'Complete the required fields with valid positive basis values.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const food =
        id === null
          ? await api.foodItems.createManual(input)
          : await api.foodItems.updateManual(id, input);
      if (id === null) setResult(food);
      router.back();
    } catch (cause) {
      setError(errorMessage(cause));
      setSaving(false);
    }
  };
  const archive = () => {
    if (id === null || loaded === null) return;
    Alert.alert(
      'Archive manual food?',
      'It will disappear from future selection but existing snapshots remain unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () =>
            void api.foodItems
              .archive(id)
              .then(() => router.back())
              .catch((cause) => setError(errorMessage(cause))),
        },
      ],
    );
  };
  if (loading)
    return (
      <AppScreen>
        <LoadingState message="Loading manual food…" />
      </AppScreen>
    );
  if (error !== null && id !== null && loaded === null)
    return (
      <AppScreen>
        <ErrorState
          title="Manual food unavailable"
          message={error}
          onRetry={() => router.back()}
        />
      </AppScreen>
    );
  return (
    <AppScreen
      contentClassName="gap-5"
      footer={
        <AppButton
          loading={saving}
          disabled={saving}
          onPress={() => void save()}
        >
          {id === null ? 'Create manual food' : 'Save changes'}
        </AppButton>
      }
    >
      <ScreenHeader
        eyebrow="Food library"
        title={id === null ? 'Create manual food' : 'Edit manual food'}
        subtitle="Enter nutrition you trust."
        action={
          <Pressable onPress={() => router.back()}>
            <AppText variant="label">Cancel</AppText>
          </Pressable>
        }
      />
      {error !== null ? (
        <ErrorState title="Check this food" message={error} />
      ) : null}
      <AppInput label="Name" value={name} onChangeText={setName} />
      <AppInput
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <AppInput
        label="Calories"
        keyboardType="decimal-pad"
        value={calories}
        onChangeText={setCalories}
      />
      <AppInput
        label="Protein"
        keyboardType="decimal-pad"
        value={protein}
        onChangeText={setProtein}
      />
      <AppInput
        label="Carbohydrates"
        keyboardType="decimal-pad"
        value={carbs}
        onChangeText={setCarbs}
      />
      <AppInput
        label="Fat"
        keyboardType="decimal-pad"
        value={fat}
        onChangeText={setFat}
      />
      <AppInput
        label="Fiber (optional)"
        keyboardType="decimal-pad"
        value={fiber}
        onChangeText={setFiber}
      />
      <AppInput
        label="Sugar (optional)"
        keyboardType="decimal-pad"
        value={sugar}
        onChangeText={setSugar}
      />
      <AppInput
        label="Sodium (optional)"
        keyboardType="number-pad"
        value={sodium}
        onChangeText={setSodium}
      />
      <View className="gap-2">
        <AppText variant="label">Nutrition basis</AppText>
        <View className="flex-row gap-2">
          <SelectableOption
            value="per_100g"
            selected={basisMode === 'per_100g'}
            label="Per 100 g"
            shape="pill"
            onSelect={() => setBasisMode('per_100g')}
          />
          <SelectableOption
            value="per_serving"
            selected={basisMode === 'per_serving'}
            label="Per serving"
            shape="pill"
            onSelect={() => setBasisMode('per_serving')}
          />
        </View>
      </View>
      {basisMode === 'per_serving' ? (
        <View className="gap-3">
          <AppInput
            label="Serving quantity"
            keyboardType="decimal-pad"
            value={quantity}
            onChangeText={setQuantity}
          />
          <View className="gap-2">
            <AppText variant="label">Serving unit</AppText>
            <View className="flex-row flex-wrap gap-2">
              {['serving', 'item', 'egg', 'slice', 'g', 'ml', 'cup'].map(
                (option) => (
                  <SelectableOption
                    key={option}
                    value={option}
                    selected={unit === option}
                    label={option}
                    shape="pill"
                    onSelect={setUnit}
                  />
                ),
              )}
            </View>
          </View>
          <View className="gap-2">
            <AppText variant="label">Declared equivalence (optional)</AppText>
            <View className="flex-row gap-2">
              <SelectableOption
                value="g"
                selected={equivalenceUnit === 'g'}
                label="grams"
                shape="pill"
                onSelect={() => setEquivalenceUnit('g')}
              />
              <SelectableOption
                value="ml"
                selected={equivalenceUnit === 'ml'}
                label="millilitres"
                shape="pill"
                onSelect={() => setEquivalenceUnit('ml')}
              />
            </View>
            <AppInput
              label="Equivalence amount"
              keyboardType="decimal-pad"
              value={equivalence}
              onChangeText={setEquivalence}
            />
          </View>
        </View>
      ) : null}
      {id !== null ? (
        <AppButton variant="secondary" onPress={archive}>
          Archive manual food
        </AppButton>
      ) : null}
    </AppScreen>
  );
}

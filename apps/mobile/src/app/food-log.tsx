import { Controller, useForm } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';

interface MockFoodLogForm {
  foodName: string;
}

export default function FoodLogScreen() {
  const { control } = useForm<MockFoodLogForm>({
    defaultValues: { foodName: '' },
  });

  return (
    <PlaceholderScreen
      title="Food log"
      description="Manual structured nutrition entry will be implemented here."
    >
      <View className="gap-2">
        <Text className="font-medium text-slate-700">Mock food name</Text>
        <Controller
          control={control}
          name="foodName"
          render={({ field: { onChange, value } }) => (
            <TextInput
              className="rounded-xl border border-slate-300 bg-white px-4 py-3"
              onChangeText={onChange}
              placeholder="Example: Chicken breast"
              value={value}
            />
          )}
        />
      </View>
    </PlaceholderScreen>
  );
}

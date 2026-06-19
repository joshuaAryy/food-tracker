import { Pressable, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { useRouter } from 'expo-router';
import { AppButton } from '@/components/app-button';
import { AppInput } from '@/components/app-input';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { ErrorState } from '@/components/error-state';
import { FormSection } from '@/components/form-section';
import { ScreenHeader } from '@/components/screen-header';
import { api, errorMessage } from '@/lib/api-client';
import { useAppStore } from '@/store/app-store';
import { useState } from 'react';

interface WeightForm {
  weightLb: string;
  loggedAt: string;
}

export default function WeightLogScreen() {
  const router = useRouter();
  const markDataChanged = useAppStore((state) => state.markDataChanged);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [defaultLoggedAt] = useState(() => new Date().toISOString());
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WeightForm>({
    defaultValues: {
      weightLb: '',
      loggedAt: defaultLoggedAt,
    },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await api.weightLogs.create({
        weightLb: Number(values.weightLb),
        loggedAt: values.loggedAt,
      });
      markDataChanged();
      router.replace('/(tabs)/progress');
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  });

  return (
    <AppScreen
      contentClassName="gap-4 pb-8"
      footer={
        <AppButton loading={isSubmitting} onPress={() => void submit()}>
          Save weight
        </AppButton>
      }
    >
      <ScreenHeader
        title="Log weight"
        subtitle="Record a manual measurement."
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

      {submitError === null ? null : (
        <ErrorState
          title="Please check your weight entry"
          message={submitError}
        />
      )}

      <FormSection
        title="Measurement"
        description="Weight is stored in pounds to one decimal place."
      >
        <Controller
          control={control}
          name="weightLb"
          rules={{
            required: 'Weight is required.',
            validate: (value) =>
              Number(value) > 0 ? true : 'Enter a weight above zero.',
          }}
          render={({ field }) => (
            <AppInput
              label="Weight (lb)"
              autoFocus
              keyboardType="decimal-pad"
              placeholder="181.4"
              value={field.value}
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              error={errors.weightLb?.message}
            />
          )}
        />
        <View className="flex-row items-center justify-between rounded-control bg-surface px-3.5 py-3">
          <View className="gap-0.5">
            <AppText variant="label">Logged now</AppText>
            <AppText variant="caption" muted>
              {new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }).format(new Date(defaultLoggedAt))}
            </AppText>
          </View>
          <View className="h-2.5 w-2.5 rounded-full bg-sage" />
        </View>
      </FormSection>
    </AppScreen>
  );
}

import { Pressable, View } from 'react-native';
import { AppInput } from './app-input';
import { AppText } from './app-text';
import type {
  ProvisionalServingPreview,
  ServingChoice,
} from '@/lib/serving-preview';

function previewCopy(preview: ProvisionalServingPreview): string | null {
  if (preview.nutrition === null) return null;

  return (
    String(preview.nutrition.calories ?? '—') +
    ' kcal · ' +
    String(preview.nutrition.protein?.toFixed(1) ?? '—') +
    ' g protein'
  );
}

export function ServingAmountControl({
  amount,
  basisLabel,
  choices,
  compact = false,
  disabled = false,
  onAmountChange,
  onReset,
  onSelectChoice,
  preview,
  selectedChoiceId,
}: {
  amount: string;
  basisLabel: string;
  choices: ServingChoice[];
  compact?: boolean;
  disabled?: boolean;
  onAmountChange: (value: string) => void;
  onReset: () => void;
  onSelectChoice: (choice: ServingChoice) => void;
  preview: ProvisionalServingPreview;
  selectedChoiceId: string | null;
}) {
  const previewText = previewCopy(preview);

  return (
    <View
      className={
        compact
          ? 'gap-2 rounded-control bg-module px-3 py-3'
          : 'gap-3 rounded-[28px] bg-module px-4 py-4'
      }
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-0.5">
          <AppText variant="label">
            {compact ? 'Serving amount' : 'Amount and unit'}
          </AppText>
          <AppText variant="caption" muted>
            {basisLabel}
          </AppText>
        </View>
        <Pressable
          accessibilityLabel="Reset amount to the nutrition basis"
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          className="rounded-full bg-[#F4F4F4] px-3 py-2 active:bg-primary-soft"
          disabled={disabled}
          onPress={onReset}
        >
          <AppText variant="label" className="text-ink">
            Reset
          </AppText>
        </Pressable>
      </View>

      <AppInput
        accessibilityLabel="Serving amount"
        autoCorrect={false}
        editable={!disabled}
        inputMode="decimal"
        keyboardType="decimal-pad"
        label="Amount"
        maxLength={9}
        placeholder="100"
        value={amount}
        onChangeText={onAmountChange}
      />

      <View className="gap-1.5">
        <AppText variant="label">Unit or listed serving</AppText>
        <View className="flex-row flex-wrap gap-2">
          {choices.map((choice) => {
            const selected = choice.id === selectedChoiceId;
            return (
              <Pressable
                key={choice.id}
                accessibilityHint="Sets the serving unit"
                accessibilityLabel={'Use ' + choice.label}
                accessibilityRole="button"
                accessibilityState={{ disabled, selected }}
                className={
                  'min-h-10 rounded-full px-3.5 py-2 ' +
                  (selected ? 'bg-primary' : 'bg-[#F4F4F4]')
                }
                disabled={disabled}
                onPress={() => onSelectChoice(choice)}
              >
                <AppText
                  variant="label"
                  className={selected ? 'text-white' : 'text-ink'}
                >
                  {choice.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {preview.status === 'needs_review' || preview.status === 'invalid' ? (
        <View className="gap-0.5 rounded-control bg-error-soft px-3 py-2.5">
          <AppText variant="label" className="text-error">
            Check this serving
          </AppText>
          <AppText variant="caption" className="text-error">
            {preview.message}
          </AppText>
        </View>
      ) : previewText === null ? null : (
        <View className="gap-0.5 rounded-control bg-primary-soft px-3 py-2.5">
          <AppText variant="caption" className="text-muted">
            Provisional preview
          </AppText>
          <AppText variant="label" className="text-ink tabular-nums">
            {previewText}
          </AppText>
          {preview.resolvedWeightGrams === null &&
          preview.resolvedVolumeMl === null ? null : (
            <AppText variant="caption" muted>
              {preview.resolvedWeightGrams === null
                ? String(preview.resolvedVolumeMl?.toFixed(1)) + ' mL resolved'
                : preview.resolvedWeightGrams.toFixed(1) + ' g resolved'}
            </AppText>
          )}
        </View>
      )}
    </View>
  );
}

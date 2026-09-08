import { useState } from 'react';
import { View } from 'react-native';
import { AppButton } from '../app-button';
import { AppInput } from '../app-input';
import { AppText } from '../app-text';
import { toUserFacingError } from '@/lib/user-facing-errors';

export interface AccountDeletionActions {
  deleteAccount(): Promise<void>;
}

interface DeleteAccountPanelProps {
  actions: AccountDeletionActions;
}

type DeletionStep = 'closed' | 'warning' | 'confirm';

const DELETE_CONFIRMATION = 'DELETE';

export function DeleteAccountPanel({ actions }: DeleteAccountPanelProps) {
  const [step, setStep] = useState<DeletionStep>('closed');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmation === DELETE_CONFIRMATION && !loading;

  function close() {
    if (loading) return;
    setStep('closed');
    setConfirmation('');
    setError(null);
  }

  async function deleteAccount() {
    if (!canDelete) return;
    setLoading(true);
    setError(null);
    try {
      await actions.deleteAccount();
    } catch (cause) {
      setError(
        toUserFacingError(
          cause,
          'We could not delete your account. Your account and data are unchanged. Try again.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  if (step === 'closed') {
    return (
      <AppButton
        accessibilityLabel="Delete account"
        variant="danger"
        onPress={() => setStep('warning')}
      >
        Delete account
      </AppButton>
    );
  }

  return (
    <View className="gap-4 rounded-3xl border border-error bg-error-soft p-5">
      <View className="gap-2">
        <AppText variant="heading">Delete your account permanently?</AppText>
        <AppText>
          This cannot be undone. Your Firebase sign-in account, profile, setup
          data, food logs, weight logs, goals, preferences, recommendations, and
          other data owned by this account will be permanently deleted.
        </AppText>
      </View>

      {step === 'warning' ? (
        <View className="gap-3">
          <AppButton
            accessibilityLabel="Continue to delete account"
            variant="danger"
            onPress={() => setStep('confirm')}
          >
            Continue to delete account
          </AppButton>
          <AppButton
            accessibilityLabel="Cancel"
            variant="secondary"
            onPress={close}
          >
            Cancel
          </AppButton>
        </View>
      ) : (
        <View className="gap-3">
          <AppText variant="label">
            Type DELETE to confirm this permanent action.
          </AppText>
          <AppInput
            accessibilityLabel="Deletion confirmation"
            autoCapitalize="characters"
            autoCorrect={false}
            label="Confirmation"
            placeholder="Type DELETE"
            value={confirmation}
            onChangeText={setConfirmation}
          />
          {error === null ? null : (
            <AppText
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="text-error"
            >
              {error}
            </AppText>
          )}
          <AppButton
            accessibilityLabel="Permanently delete account"
            accessibilityHint="Permanently deletes this account and its data"
            disabled={!canDelete}
            loading={loading}
            variant="danger"
            onPress={() => void deleteAccount()}
          >
            Permanently delete account
          </AppButton>
          <AppButton
            accessibilityLabel="Cancel"
            disabled={loading}
            variant="secondary"
            onPress={close}
          >
            Cancel
          </AppButton>
        </View>
      )}
    </View>
  );
}

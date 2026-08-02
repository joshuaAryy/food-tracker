import { useState } from 'react';
import { View } from 'react-native';
import { AppButton } from '../app-button';
import { AppInput } from '../app-input';
import { AppText } from '../app-text';
import { toUserFacingError } from '@/lib/user-facing-errors';

export interface AccountDeletionActions {
  reauthenticateWithPassword(password: string): Promise<void>;
  reauthenticateWithGoogle(): Promise<void>;
  deleteAccount(): Promise<void>;
}

interface DeleteAccountPanelProps {
  providerIds: string[];
  actions: AccountDeletionActions;
}

type DeletionStep = 'closed' | 'warning' | 'confirm';

const DELETE_CONFIRMATION = 'DELETE';

export function DeleteAccountPanel({
  providerIds,
  actions,
}: DeleteAccountPanelProps) {
  const [step, setStep] = useState<DeletionStep>('closed');
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportsPassword = providerIds.includes('password');
  const supportsGoogle = providerIds.includes('google.com');
  const supportsReauthentication = supportsPassword || supportsGoogle;
  const canDelete =
    confirmation === DELETE_CONFIRMATION &&
    (!supportsPassword || password.length > 0) &&
    supportsReauthentication &&
    !loading;

  function close() {
    if (loading) return;
    setStep('closed');
    setConfirmation('');
    setPassword('');
    setError(null);
  }

  async function deleteAccount() {
    if (!canDelete) return;
    setLoading(true);
    setError(null);
    try {
      if (supportsPassword) {
        await actions.reauthenticateWithPassword(password);
      } else if (supportsGoogle) {
        await actions.reauthenticateWithGoogle();
      } else {
        setError('This sign-in method cannot securely delete the account.');
        return;
      }
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
            Type DELETE to confirm. You will need to verify your identity again.
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
          {supportsPassword ? (
            <AppInput
              accessibilityLabel="Current password"
              autoCapitalize="none"
              autoCorrect={false}
              label="Current password"
              placeholder="Current password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          ) : supportsGoogle ? (
            <AppText variant="caption" muted>
              Google will ask you to verify your account before deletion.
            </AppText>
          ) : (
            <AppText variant="caption" className="text-error">
              This sign-in method cannot securely delete the account.
            </AppText>
          )}
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

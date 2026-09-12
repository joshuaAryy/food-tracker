import { useState } from 'react';
import { View } from 'react-native';
import { AppButton } from '../app-button';
import { AppInput } from '../app-input';
import { AppText } from '../app-text';
import { toUserFacingError } from '@/lib/user-facing-errors';

export interface AccountDeletionActions {
  deleteAccount(): Promise<void>;
  providerIds?: string[];
  reauthenticateWithPassword?(password: string): Promise<void>;
  reauthenticateWithGoogle?(): Promise<void>;
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
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthRequired, setReauthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete =
    confirmation === DELETE_CONFIRMATION && !loading && !reauthLoading;

  function close() {
    if (loading) return;
    setStep('closed');
    setConfirmation('');
    setReauthPassword('');
    setReauthRequired(false);
    setError(null);
  }

  function errorCode(cause: unknown): string | undefined {
    if (typeof cause !== 'object' || cause === null) return undefined;
    const code = (cause as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }

  async function deleteAccount() {
    if (!canDelete) return;
    setLoading(true);
    setError(null);
    try {
      await actions.deleteAccount();
    } catch (cause) {
      if (errorCode(cause) === 'RECENT_AUTH_REQUIRED') {
        setReauthRequired(true);
      }
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

  async function reauthenticate() {
    if (reauthLoading) return;
    const hasPassword =
      actions.providerIds?.includes('password') === true &&
      actions.reauthenticateWithPassword !== undefined;
    const hasGoogle =
      actions.providerIds?.includes('google.com') === true &&
      actions.reauthenticateWithGoogle !== undefined;
    if (!hasPassword && !hasGoogle) return;
    setReauthLoading(true);
    setError(null);
    try {
      if (hasPassword) {
        if (reauthPassword === '') return;
        await actions.reauthenticateWithPassword?.(reauthPassword);
      } else {
        await actions.reauthenticateWithGoogle?.();
      }
      setReauthRequired(false);
      setReauthPassword('');
      await actions.deleteAccount();
    } catch (cause) {
      if (errorCode(cause) === 'RECENT_AUTH_REQUIRED') {
        setReauthRequired(true);
      }
      setError(
        toUserFacingError(
          cause,
          'We could not verify your identity. Try again.',
        ),
      );
    } finally {
      setReauthLoading(false);
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
          {reauthRequired ? (
            <View className="gap-3">
              <AppText>
                Verify your identity to continue deleting this account.
              </AppText>
              {actions.providerIds?.includes('password') === true &&
              actions.reauthenticateWithPassword !== undefined ? (
                <AppInput
                  accessibilityLabel="Current password"
                  autoCapitalize="none"
                  autoCorrect={false}
                  label="Current password"
                  placeholder="Current password"
                  secureTextEntry
                  value={reauthPassword}
                  onChangeText={setReauthPassword}
                />
              ) : null}
              <AppButton
                accessibilityLabel={
                  actions.providerIds?.includes('password') === true
                    ? 'Verify identity'
                    : 'Verify with Google'
                }
                disabled={
                  reauthLoading ||
                  (actions.providerIds?.includes('password') === true &&
                    reauthPassword === '')
                }
                loading={reauthLoading}
                variant="secondary"
                onPress={() => void reauthenticate()}
              >
                {actions.providerIds?.includes('password') === true
                  ? 'Verify identity'
                  : 'Verify with Google'}
              </AppButton>
            </View>
          ) : null}
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

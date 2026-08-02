import { useState } from 'react';
import { AppButton } from '../app-button';

interface AccountSignOutButtonProps {
  onSignOut: () => Promise<void>;
}

export function AccountSignOutButton({ onSignOut }: AccountSignOutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function signOut() {
    if (loading) return;
    setLoading(true);
    try {
      await onSignOut();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppButton
      accessibilityLabel={loading ? 'Signing out' : 'Sign out'}
      disabled={loading}
      variant="secondary"
      className="border border-[#E0E0DB] bg-white"
      onPress={() => void signOut()}
    >
      Sign out
    </AppButton>
  );
}

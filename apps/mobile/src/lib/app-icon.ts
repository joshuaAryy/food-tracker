import type { TrackingMode } from '@food-tracker/shared';
import {
  getAppIconName,
  setAlternateAppIcon,
  supportsAlternateIcons,
} from 'expo-alternate-app-icons';

const complexModeIconName = 'ComplexMode';

export function desiredAppIconName(mode: TrackingMode): string | null {
  return mode === 'complex' ? complexModeIconName : null;
}

export async function syncLauncherIconToMode(
  mode: TrackingMode,
): Promise<boolean> {
  if (!supportsAlternateIcons) {
    return false;
  }

  const desiredIcon = desiredAppIconName(mode);
  const currentIcon = getAppIconName();

  if (currentIcon === desiredIcon) {
    return true;
  }

  await setAlternateAppIcon(desiredIcon);
  return true;
}

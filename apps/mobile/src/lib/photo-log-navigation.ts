import type { Href } from 'expo-router';

export interface PhotoLogBackNavigation {
  canGoBack: () => boolean;
  back: () => void;
  replace: (route: Href) => void;
  fallback: Href;
}

/**
 * Photo-log screens can be opened as a modal, by replace navigation, or as a
 * direct route after a development reload. Only dispatch back when the
 * current navigator can handle it; otherwise use the route's owning root.
 */
export function safePhotoLogBack(input: PhotoLogBackNavigation): void {
  if (input.canGoBack()) {
    input.back();
    return;
  }
  input.replace(input.fallback);
}

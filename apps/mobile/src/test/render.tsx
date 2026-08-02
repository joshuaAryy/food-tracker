import type { ReactElement } from 'react';
import {
  render as renderNative,
  type RenderOptions,
} from '@testing-library/react-native';

export async function render(
  element: ReactElement,
  options?: RenderOptions,
): Promise<Awaited<ReturnType<typeof renderNative>>> {
  return renderNative(element, options);
}

export * from '@testing-library/react-native';

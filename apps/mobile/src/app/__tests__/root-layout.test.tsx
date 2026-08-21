import React from 'react';
import { render } from '../../test/render';
import RootLayout from '../_layout';

const mockReact = jest.requireActual('react') as typeof React;

jest.mock('expo-router', () => {
  const Stack = ({ children }: { children: React.ReactNode }) =>
    mockReact.createElement(mockReact.Fragment, null, children);
  Stack.Screen = () => null;
  return { Stack };
});

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

jest.mock('../../global.css', () => ({}));

jest.mock('react-native-gesture-handler', () => {
  return {
    GestureHandlerRootView: (props: {
      children: React.ReactNode;
      [key: string]: unknown;
    }) => mockReact.createElement('View', props, props.children),
  };
});

jest.mock('@/components/auth/auth-bootstrap', () => ({
  AuthBootstrap: ({ children }: { children: React.ReactNode }) =>
    mockReact.createElement(mockReact.Fragment, null, children),
}));

describe('root layout', () => {
  it('mounts the navigation tree under GestureHandlerRootView', async () => {
    const { getByTestId } = await render(<RootLayout />);

    expect(getByTestId('gesture-handler-root')).toBeTruthy();
  });
});

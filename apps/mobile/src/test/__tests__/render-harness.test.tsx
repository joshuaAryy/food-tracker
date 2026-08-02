import React, { useState } from 'react';
import { Text, Pressable } from 'react-native';
import { render, userEvent } from '../render';

function HarnessButton(): React.JSX.Element {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable accessibilityRole="button" onPress={() => setPressed(true)}>
      <Text>{pressed ? 'Pressed' : 'Press me'}</Text>
    </Pressable>
  );
}

describe('mobile Jest/RNTL render harness', () => {
  it('supports asynchronous user interaction', async () => {
    const user = userEvent.setup();
    const screen = await render(<HarnessButton />);

    await user.press(screen.getByRole('button', { name: 'Press me' }));

    expect(screen.getByText('Pressed')).toBeTruthy();
  });
});

import { Text } from 'react-native';
import { render } from '../../test/render';
import { AppScreen } from '../app-screen';

describe('AppScreen keyboard behavior', () => {
  it('passes drag dismissal through to the scroll container', async () => {
    const screen = await render(
      <AppScreen testID="app-screen-scroll" keyboardDismissMode="on-drag">
        <Text>Meal description</Text>
      </AppScreen>,
    );

    expect(
      screen.getByTestId('app-screen-scroll').props.keyboardDismissMode,
    ).toBe('on-drag');
  });
});

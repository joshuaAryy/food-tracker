import { render } from '../../test/render';
import { ScreenHeader } from '../screen-header';

describe('ScreenHeader', () => {
  it('keeps a long page title to one truncated line while allowing supporting copy to grow', async () => {
    const screen = await render(
      <ScreenHeader
        title="A very long saved analytics view title that must remain understandable"
        subtitle="Supporting context can grow vertically on a constrained analytics screen."
      />,
    );

    expect(
      screen.getByText(
        'A very long saved analytics view title that must remain understandable',
      ).props,
    ).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail' });
    expect(
      screen.getByText(
        'Supporting context can grow vertically on a constrained analytics screen.',
      ).props.numberOfLines,
    ).toBeUndefined();
  });
});

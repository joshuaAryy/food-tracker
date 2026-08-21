import { ReportPeriodSelector } from '../report-period-selector';
import { render } from '../../test/render';

describe('ReportPeriodSelector', () => {
  it('exposes stable controls for simulator and accessibility validation', async () => {
    const screen = await render(
      <ReportPeriodSelector period="week" onChange={() => undefined} />,
    );

    expect(screen.getByTestId('report-period-week')).toBeTruthy();
    expect(screen.getByTestId('report-period-month')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Month reports' })).toBeTruthy();
    expect(
      screen.getByTestId('report-period-selector').props.className,
    ).toEqual(expect.stringContaining('w-[180px]'));
  });
});

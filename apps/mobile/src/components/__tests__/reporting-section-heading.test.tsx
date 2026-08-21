import { render } from '@/test/render';
import { ReportingSectionHeading } from '../reporting-section-heading';

describe('ReportingSectionHeading', () => {
  it('keeps the semantic section icon when a complex overview marker is supplied', async () => {
    const screen = await render(
      <ReportingSectionHeading
        icon="detail"
        title="Hydration"
        markerColor="#337CCA"
      />,
    );

    expect(screen.getByTestId('reporting-section-marker-detail')).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain('reporting-icon-detail');
  });
});

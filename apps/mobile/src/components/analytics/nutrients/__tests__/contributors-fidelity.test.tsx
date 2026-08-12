import type { AnalyticsContributorsResponse } from '@food-tracker/shared';
import { render } from '@/test/render';
import { ContributorsSheet } from '../contributors-sheet';

const contributors: AnalyticsContributorsResponse = {
  metric: 'vitaminC',
  resolvedRange: { startDate: '2026-07-06', endDate: '2026-08-04' },
  recordedTotal: 2592,
  contributors: [
    { foodName: 'Orange', value: 544, percentage: 0.21 },
    { foodName: 'Bell pepper', value: 467, percentage: 0.18 },
    { foodName: 'Strawberries', value: 337, percentage: 0.13 },
  ],
  remainder: { value: 571, percentage: 0.22 },
  hasMore: true,
};

describe('contributors sheet fidelity', () => {
  it('renders canonical total, rows, progress, and source explanation', async () => {
    const screen = await render(
      <ContributorsSheet
        metricName="Vitamin C"
        unit="mg"
        data={contributors}
        loading={false}
        error={null}
        onRetry={jest.fn()}
      />,
    );

    expect(screen.getByText('Vitamin C contributors')).toBeTruthy();
    expect(screen.getByText('2,592 mg')).toBeTruthy();
    expect(screen.getByText('1. Orange')).toBeTruthy();
    expect(screen.getByText('21%')).toBeTruthy();
    expect(screen.getByText('Other recorded foods')).toBeTruthy();
    expect(
      screen.getByText(
        /unknown nutrient values are excluded rather than treated as zero/,
      ),
    ).toBeTruthy();
  });

  it('keeps loading and failure local to the contributor surface', async () => {
    const screen = await render(
      <ContributorsSheet
        metricName="Vitamin C"
        unit="mg"
        data={null}
        loading={false}
        error="Contributors unavailable"
        onRetry={jest.fn()}
      />,
    );
    expect(screen.getByText('Contributors unavailable')).toBeTruthy();
  });
});

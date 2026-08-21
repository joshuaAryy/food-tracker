import type { CanonicalTrendResponse } from '@food-tracker/shared';
import { render, userEvent } from '@/test/render';
import { AminoAcidProfile } from '../amino-acid-profile';
import { LeucineDetail } from '../leucine-detail';

const profile: NonNullable<CanonicalTrendResponse['aminoAcidProfile']> = {
  recordedDayCount: 27,
  entries: [
    {
      metric: 'leucine',
      average: 2.8,
      reference: { kind: 'minimum', value: 2.6, unit: 'g', source: 'default' },
      percentage: 108,
      status: 'meets_minimum',
    },
    {
      metric: 'lysine',
      average: 1.5,
      reference: { kind: 'minimum', value: 2.1, unit: 'g', source: 'default' },
      percentage: 71.4,
      status: 'below_minimum',
    },
  ],
};

describe('amino-acid report fidelity', () => {
  it('renders the canonical profile entries and opens an individual trend', async () => {
    const onOpenMetric = jest.fn();
    const screen = await render(
      <AminoAcidProfile profile={profile} onOpenMetric={onOpenMetric} />,
    );

    expect(screen.getByText('Protein & amino acids')).toBeTruthy();
    expect(screen.getByText('Leucine')).toBeTruthy();
    expect(screen.getByText('2.8 g')).toBeTruthy();
    expect(screen.getByText('108%')).toBeTruthy();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Open Leucine trend' }));
    expect(onOpenMetric).toHaveBeenCalledWith('leucine');
  });

  it('keeps an unavailable Leucine reference and trend state explicit', async () => {
    const screen = await render(
      <LeucineDetail
        trend={{
          timezone: 'America/New_York',
          trackingMode: 'complex',
          primaryMetric: 'leucine',
          aggregation: 'daily',
          resolvedRange: { startDate: '2026-08-01', endDate: '2026-08-30' },
          firstEligibleDate: null,
          today: '2026-08-30',
          reference: { kind: 'none', unit: 'g', reason: 'not_configured' },
          interpretation: null,
          relatedMetrics: [],
          points: [],
          summary: { numericDayCount: 0, average: null },
        }}
      />,
    );

    expect(screen.getByText('Leucine target detail')).toBeTruthy();
    expect(screen.getByText('Reference unavailable')).toBeTruthy();
    expect(
      screen.getByText('No recorded Leucine data in this period.'),
    ).toBeTruthy();
  });
});

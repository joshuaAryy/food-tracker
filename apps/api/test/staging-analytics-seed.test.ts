import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  buildStagingAnalyticsFixture,
  assertStagingSeedSafety,
  classifyFixtureDays,
} from '../src/scripts/staging-analytics-fixture.js';
import { seedStagingAnalyticsQa } from '../src/scripts/seed-staging-analytics-qa.js';
import { isCompleteProfile } from '../src/lib/setup-completeness.js';

describe('staging analytics QA fixture', () => {
  it('is deterministic for the same anchor and shifts dates for a new anchor', () => {
    const first = buildStagingAnalyticsFixture({ anchorDate: '2026-08-12' });
    const second = buildStagingAnalyticsFixture({ anchorDate: '2026-08-12' });
    const shifted = buildStagingAnalyticsFixture({ anchorDate: '2026-08-13' });

    expect(first).toEqual(second);
    expect(first.foodLogs.map((log) => log.loggedAt)).not.toEqual(
      shifted.foodLogs.map((log) => log.loggedAt),
    );
    expect(first.foodLogs.length).toBeGreaterThan(500);
    expect(first.weightLogs.length).toBeGreaterThan(100);
    expect(first.waterLogs.length).toBeGreaterThan(300);
    expect(first.profile.birthDate).toBe('1992-06-15');
  });

  it('creates complete, partial, unlogged, and in-progress fixture days', () => {
    const fixture = buildStagingAnalyticsFixture({ anchorDate: '2026-08-12' });
    const states = classifyFixtureDays(fixture);

    expect(states.today.phase).toBe('in_progress');
    expect(states.today.state).toBe('partial');
    expect(states.counts.complete).toBeGreaterThan(states.counts.partial);
    expect(states.counts.partial).toBeGreaterThan(0);
    expect(states.counts.unlogged).toBeGreaterThan(0);
    expect(
      states.unloggedDates.every((date) =>
        fixture.foodLogs.every((log) => log.localDate !== date),
      ),
    ).toBe(true);
  });

  it('keeps sparse nutrients missing and explicit zero values explicit', () => {
    const fixture = buildStagingAnalyticsFixture({ anchorDate: '2026-08-12' });
    const vitaminDEntries = fixture.foodLogNutrients.filter(
      (entry) => entry.nutrientKey === 'vitaminD',
    );
    const omega3Zeros = fixture.foodLogNutrients.filter(
      (entry) => entry.nutrientKey === 'omega3' && entry.amount === 0,
    );

    expect(vitaminDEntries.length).toBeGreaterThan(0);
    expect(vitaminDEntries.length).toBeLessThan(
      fixture.foodLogs.filter((log) => log.localDate !== '2026-08-12').length,
    );
    expect(omega3Zeros.length).toBeGreaterThan(0);
  });

  it('builds four saved views with exactly one pinned view', () => {
    const fixture = buildStagingAnalyticsFixture({ anchorDate: '2026-08-12' });

    expect(fixture.savedViews).toHaveLength(4);
    expect(fixture.savedViews.filter((view) => view.pinned)).toHaveLength(1);
    expect(fixture.savedViews.map((view) => view.name)).toEqual([
      'Calories · 90D',
      'Protein + Weight · 90D',
      'Sodium + Potassium · normalized',
      'Hydration · 30D',
    ]);
  });
});

describe('staging analytics QA safety', () => {
  it('requires staging, explicit reset confirmation, and a target identifier', () => {
    expect(() =>
      assertStagingSeedSafety({
        appEnv: 'production',
        allowReset: true,
        target: 'uid',
      }),
    ).toThrow(/staging/i);
    expect(() =>
      assertStagingSeedSafety({
        appEnv: 'staging',
        allowReset: false,
        target: 'uid',
      }),
    ).toThrow(/reset/i);
    expect(() =>
      assertStagingSeedSafety({
        appEnv: 'staging',
        allowReset: true,
        target: '',
      }),
    ).toThrow(/target/i);
    expect(() =>
      assertStagingSeedSafety({
        appEnv: 'staging',
        allowReset: true,
        target: 'uid',
      }),
    ).not.toThrow();
  });
});

describe('staging analytics QA persistence', () => {
  it('resets and reseeds only the explicitly targeted Firebase user', async () => {
    const target = await prisma.user.create({
      data: { email: 'qa-target@example.test', firebaseUid: 'qa-target' },
    });
    const other = await prisma.user.create({
      data: { email: 'other@example.test', firebaseUid: 'other-user' },
    });
    await prisma.foodLog.create({
      data: {
        userId: other.id,
        foodName: 'Other user data',
        mealType: 'lunch',
        calories: 400,
        protein: 30,
        loggedAt: new Date('2026-08-01T12:00:00.000Z'),
      },
    });

    const report = await seedStagingAnalyticsQa({
      appEnv: 'staging',
      allowReset: true,
      firebaseUid: 'qa-target',
      anchorDate: '2026-08-12',
    });

    expect(report.foodLogCount).toBeGreaterThan(500);
    expect(await prisma.foodLog.count({ where: { userId: target.id } })).toBe(
      report.foodLogCount,
    );
    const profile = await prisma.userProfile.findUnique({
      where: { userId: target.id },
    });
    expect(isCompleteProfile(profile)).toBe(true);
    expect(await prisma.foodLog.count({ where: { userId: other.id } })).toBe(1);
    expect(
      await prisma.user.count({ where: { firebaseUid: 'qa-target' } }),
    ).toBe(1);
  });

  it('rejects an email that matches more than one Firebase-linked user', async () => {
    await prisma.user.createMany({
      data: [
        { email: 'ambiguous@example.test', firebaseUid: 'ambiguous-1' },
        { email: 'ambiguous@example.test', firebaseUid: 'ambiguous-2' },
      ],
    });

    await expect(
      seedStagingAnalyticsQa({
        appEnv: 'staging',
        allowReset: true,
        email: 'ambiguous@example.test',
        anchorDate: '2026-08-12',
      }),
    ).rejects.toThrow(/exactly one/i);
  });

  it('produces the same persisted fixture counts on reset and reseed', async () => {
    const target = await prisma.user.create({
      data: { email: 'qa-repeat@example.test', firebaseUid: 'qa-repeat' },
    });
    const input = {
      appEnv: 'staging',
      allowReset: true,
      firebaseUid: 'qa-repeat',
      anchorDate: '2026-08-12',
    } as const;

    const first = await seedStagingAnalyticsQa(input);
    const firstTotals = await prisma.foodLog.aggregate({
      where: { userId: target.id },
      _sum: { calories: true },
    });
    const second = await seedStagingAnalyticsQa(input);
    const secondTotals = await prisma.foodLog.aggregate({
      where: { userId: target.id },
      _sum: { calories: true },
    });

    expect(second).toEqual(first);
    expect(secondTotals._sum.calories).toBe(firstTotals._sum.calories);
    expect(
      await prisma.analyticsSavedView.count({ where: { userId: target.id } }),
    ).toBe(4);
    expect(
      await prisma.analyticsPreference.findFirst({
        where: { userId: target.id },
        select: { pinnedSavedViewId: true },
      }),
    ).toMatchObject({ pinnedSavedViewId: expect.any(String) });
  });
});

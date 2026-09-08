import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  assertStagingSeedSafety,
  buildStagingAnalyticsFixture,
  type StagingAnalyticsFixture,
} from './staging-analytics-fixture.js';

export interface StagingAnalyticsSeedInput {
  appEnv?: string;
  allowReset: boolean;
  firebaseUid?: string;
  email?: string;
  anchorDate: string;
  historyDays?: number;
}

export interface StagingAnalyticsSeedReport {
  foodLogCount: number;
  nutrientSnapshotCount: number;
  weightLogCount: number;
  waterLogCount: number;
  savedViewCount: number;
  recommendationCount: number;
  pinnedSavedViewCount: number;
  anchorDate: string;
  historyDays: number;
}

type TransactionClient = Parameters<
  Parameters<PrismaClient['$transaction']>[0]
>[0];

async function targetUser(
  transaction: TransactionClient,
  input: StagingAnalyticsSeedInput,
) {
  if (input.firebaseUid !== undefined) {
    const user = await transaction.user.findUnique({
      where: { firebaseUid: input.firebaseUid },
    });
    if (user === null) throw new Error('No staging user matches firebase UID.');
    if (input.email !== undefined && user.email !== input.email) {
      throw new Error('Firebase UID and email identify different users.');
    }
    if (user.firebaseUid === null) {
      throw new Error('The target user is not Firebase-linked.');
    }
    return user;
  }

  if (input.email === undefined) {
    throw new Error('An explicit firebase UID or email is required.');
  }
  const matches = await transaction.user.findMany({
    where: { email: input.email },
  });
  if (matches.length !== 1) {
    throw new Error('Email target must match exactly one staging user.');
  }
  const user = matches[0]!;
  if (user.firebaseUid === null) {
    throw new Error('The target user is not Firebase-linked.');
  }
  return user;
}

async function resetTargetUser(
  transaction: TransactionClient,
  userId: string,
): Promise<void> {
  await transaction.foodLogNutrient.deleteMany({
    where: { foodLog: { userId } },
  });
  await transaction.foodLog.deleteMany({ where: { userId } });
  await transaction.weightLog.deleteMany({ where: { userId } });
  await transaction.waterLog.deleteMany({ where: { userId } });
  await transaction.analyticsPreference.deleteMany({ where: { userId } });
  await transaction.analyticsSavedView.deleteMany({ where: { userId } });
  await transaction.recommendation.deleteMany({ where: { userId } });
  await transaction.userGoal.deleteMany({ where: { userId } });
  await transaction.userProfile.deleteMany({ where: { userId } });
  await transaction.trackingPreference.deleteMany({ where: { userId } });
}

async function persistFixture(
  transaction: TransactionClient,
  userId: string,
  fixture: StagingAnalyticsFixture,
): Promise<StagingAnalyticsSeedReport> {
  await transaction.userProfile.create({
    data: {
      userId,
      name: fixture.profile.name,
      age: fixture.profile.age,
      birthDate: new Date(`${fixture.profile.birthDate}T00:00:00.000Z`),
      sex: fixture.profile.sex,
      heightInches: fixture.profile.heightInches,
      timezone: fixture.timezone,
      startingWeightLb: fixture.profile.startingWeightLb,
      activityLevel: fixture.profile.activityLevel,
      trainingStyle: fixture.profile.trainingStyle,
    },
  });
  await transaction.userGoal.create({
    data: { userId, ...fixture.goal },
  });
  await transaction.trackingPreference.create({
    data: { userId, ...fixture.preference },
  });

  await transaction.foodLog.createMany({
    data: fixture.foodLogs.map((log) => ({
      userId,
      foodName: log.foodName,
      mealType: log.mealType,
      calories: log.calories,
      protein: log.protein,
      carbs: log.carbs,
      fat: log.fat,
      fiber: log.fiber,
      sugar: log.sugar,
      sodium: log.sodium,
      servingQuantity: log.servingQuantity,
      servingUnit: log.servingUnit,
      loggedAt: log.loggedAt,
    })),
  });
  const createdLogs = await transaction.foodLog.findMany({
    where: { userId },
    orderBy: [{ loggedAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (createdLogs.length !== fixture.foodLogs.length) {
    throw new Error('QA seed could not reconcile created FoodLogs.');
  }
  await transaction.foodLogNutrient.createMany({
    data: fixture.foodLogNutrients.map((nutrient) => ({
      foodLogId: createdLogs[nutrient.foodLogIndex]!.id,
      nutrientKey: nutrient.nutrientKey,
      amount: nutrient.amount,
      unit: nutrient.unit,
    })),
  });

  await transaction.weightLog.createMany({
    data: fixture.weightLogs.map((log) => ({
      userId,
      weightLb: log.weightLb,
      loggedAt: log.loggedAt,
    })),
  });
  await transaction.waterLog.createMany({
    data: fixture.waterLogs.map((log) => ({
      userId,
      amountMl: log.amountMl,
      loggedAt: log.loggedAt,
    })),
  });

  await transaction.analyticsSavedView.createMany({
    data: fixture.savedViews.map((view, sortOrder) => ({
      userId,
      name: view.name,
      primaryMetric: view.primaryMetric,
      comparisonMetric: view.comparisonMetric,
      periodDays: view.periodDays,
      aggregation: view.aggregation,
      visualization: view.visualization,
      showReference: view.showReference,
      coverageFilter: view.coverageFilter,
      sortOrder,
    })),
  });
  const pinnedView = await transaction.analyticsSavedView.findFirst({
    where: { userId, name: 'Protein + Weight · 90D' },
    select: { id: true },
  });
  if (pinnedView === null)
    throw new Error('QA seed could not find pinned view.');
  await transaction.analyticsPreference.create({
    data: {
      userId,
      preferredSimpleMetric: 'calories',
      pinnedSavedViewId: pinnedView.id,
    },
  });
  await transaction.recommendation.createMany({
    data: fixture.recommendations.map((recommendation) => ({
      userId,
      identityKey: recommendation.type,
      conditionFingerprint: `${recommendation.type}:${userId}`,
      ...recommendation,
    })),
  });

  return {
    foodLogCount: fixture.foodLogs.length,
    nutrientSnapshotCount: fixture.foodLogNutrients.length,
    weightLogCount: fixture.weightLogs.length,
    waterLogCount: fixture.waterLogs.length,
    savedViewCount: fixture.savedViews.length,
    recommendationCount: fixture.recommendations.length,
    pinnedSavedViewCount: 1,
    anchorDate: fixture.anchorDate,
    historyDays: fixture.historyDays,
  };
}

export async function seedStagingAnalyticsQa(
  input: StagingAnalyticsSeedInput,
  database: PrismaClient = prisma,
): Promise<StagingAnalyticsSeedReport> {
  const target = input.firebaseUid ?? input.email;
  assertStagingSeedSafety({
    appEnv: input.appEnv ?? process.env.APP_ENV,
    allowReset: input.allowReset,
    target,
  });
  const fixtureOptions = {
    anchorDate: input.anchorDate,
    ...(input.historyDays === undefined
      ? {}
      : { historyDays: input.historyDays }),
  };
  const fixture = buildStagingAnalyticsFixture(fixtureOptions);

  return database.$transaction(
    async (transaction) => {
      const user = await targetUser(transaction, input);
      await resetTargetUser(transaction, user.id);
      return persistFixture(transaction, user.id, fixture);
    },
    {
      maxWait: 30_000,
      timeout: 120_000,
    },
  );
}

interface CliArguments {
  firebaseUid?: string;
  email?: string;
  anchorDate?: string;
  reset: boolean;
}

function parseArguments(argv: readonly string[]): CliArguments {
  const result: CliArguments = { reset: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === '--firebase-uid' && value !== undefined) {
      result.firebaseUid = value;
      index += 1;
    } else if (argument === '--email' && value !== undefined) {
      result.email = value;
      index += 1;
    } else if (argument === '--anchor-date' && value !== undefined) {
      result.anchorDate = value;
      index += 1;
    } else if (argument === '--reset') {
      result.reset = true;
    } else if (argument === '--help') {
      writeOutput(
        'Required: --firebase-uid <uid> or --email <email> --anchor-date YYYY-MM-DD --reset',
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument ?? ''}`);
    }
  }
  if (result.anchorDate === undefined)
    throw new Error('--anchor-date is required.');
  return result;
}

function writeOutput(message: string): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message: string): void {
  process.stderr.write(`${message}\n`);
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const seedInput = {
    allowReset: args.reset,
    anchorDate: args.anchorDate!,
    ...(process.env.APP_ENV === undefined
      ? {}
      : { appEnv: process.env.APP_ENV }),
    ...(args.firebaseUid === undefined
      ? {}
      : { firebaseUid: args.firebaseUid }),
    ...(args.email === undefined ? {} : { email: args.email }),
  };
  const report = await seedStagingAnalyticsQa(seedInput);
  writeOutput(
    `Staging QA seed complete: anchor=${report.anchorDate}, historyDays=${report.historyDays}, foodLogs=${report.foodLogCount}, nutrients=${report.nutrientSnapshotCount}, weights=${report.weightLogCount}, waterLogs=${report.waterLogCount}, savedViews=${report.savedViewCount}, pinned=${report.pinnedSavedViewCount}`,
  );
}

if (process.argv[1]?.endsWith('seed-staging-analytics-qa.ts')) {
  main()
    .catch((error: unknown) => {
      writeError(
        error instanceof Error ? error.message : 'Staging QA seed failed.',
      );
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

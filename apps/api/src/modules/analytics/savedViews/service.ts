import {
  analyticsMetricForKey,
  analyticsMetricKeySchema,
  analyticsSavedViewConfigurationSchema,
  type AnalyticsPreferenceUpdateInput,
  type AnalyticsPreferenceValue,
  type AnalyticsSavedView,
  type AnalyticsSavedViewCreateInput,
  type AnalyticsSavedViewOrderInput,
  type AnalyticsSavedViewUpdateInput,
} from '@food-tracker/shared';
import { AppError, notFoundError } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { validateSavedViewConfiguration } from './configuration-validation.js';

type StoredAnalyticsSavedView = Awaited<
  ReturnType<typeof prisma.analyticsSavedView.findFirstOrThrow>
>;

function unavailableMetrics(view: StoredAnalyticsSavedView): string[] {
  return [view.primaryMetric, view.comparisonMetric]
    .filter((metric): metric is string => metric !== null)
    .filter((metric) => !analyticsMetricKeySchema.safeParse(metric).success);
}

function serializeSavedView(view: StoredAnalyticsSavedView): AnalyticsSavedView {
  return {
    id: view.id,
    name: view.name,
    primaryMetric: view.primaryMetric,
    comparisonMetric: view.comparisonMetric,
    periodDays: view.periodDays,
    aggregation: view.aggregation,
    visualization: view.visualization,
    showReference: view.showReference,
    coverageFilter: view.coverageFilter,
    sortOrder: view.sortOrder,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
    unavailableMetrics: unavailableMetrics(view),
  };
}

function analyticsPreferenceValue(input: {
  preferredSimpleMetric: string;
  pinnedSavedViewId: string | null;
}): AnalyticsPreferenceValue {
  const parsed = analyticsMetricKeySchema.safeParse(input.preferredSimpleMetric);
  return {
    preferredSimpleMetric:
      parsed.success && analyticsMetricForKey(parsed.data).simpleAvailable
        ? parsed.data
        : 'calories',
    pinnedSavedViewId: input.pinnedSavedViewId,
  };
}

async function ownedSavedView(userId: string, id: string) {
  const view = await prisma.analyticsSavedView.findFirst({
    where: { id, userId },
  });
  if (view === null) throw notFoundError('Analytics saved view');
  return view;
}

export async function requireComplexAnalyticsMode(userId: string): Promise<void> {
  const preferences = await prisma.trackingPreference.findUnique({
    where: { userId },
    select: { mode: true },
  });
  if (preferences?.mode !== 'complex') {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Saved views are available in Complex mode only',
    );
  }
}

export async function listAnalyticsSavedViews(
  userId: string,
): Promise<AnalyticsSavedView[]> {
  const views = await prisma.analyticsSavedView.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return views.map(serializeSavedView);
}

export async function createAnalyticsSavedView(
  userId: string,
  input: AnalyticsSavedViewCreateInput,
): Promise<AnalyticsSavedView> {
  validateSavedViewConfiguration(input);
  const sortOrder = await prisma.analyticsSavedView.count({ where: { userId } });
  const view = await prisma.analyticsSavedView.create({
    data: {
      userId,
      name: input.name,
      primaryMetric: input.primaryMetric,
      comparisonMetric: input.comparisonMetric ?? null,
      periodDays: input.periodDays,
      aggregation: input.aggregation,
      visualization: input.visualization,
      showReference: input.showReference,
      coverageFilter: input.coverageFilter,
      sortOrder,
    },
  });
  return serializeSavedView(view);
}

export async function updateAnalyticsSavedView(
  userId: string,
  id: string,
  input: AnalyticsSavedViewUpdateInput,
): Promise<AnalyticsSavedView> {
  const existing = await ownedSavedView(userId, id);
  const merged = {
    primaryMetric: existing.primaryMetric,
    comparisonMetric: existing.comparisonMetric,
    periodDays: existing.periodDays,
    aggregation: existing.aggregation,
    visualization: existing.visualization,
    showReference: existing.showReference,
    coverageFilter: existing.coverageFilter,
    ...(input.primaryMetric === undefined
      ? {}
      : { primaryMetric: input.primaryMetric }),
    ...(input.comparisonMetric === undefined
      ? {}
      : { comparisonMetric: input.comparisonMetric }),
    ...(input.periodDays === undefined
      ? {}
      : { periodDays: input.periodDays }),
    ...(input.aggregation === undefined
      ? {}
      : { aggregation: input.aggregation }),
    ...(input.visualization === undefined
      ? {}
      : { visualization: input.visualization }),
    ...(input.showReference === undefined
      ? {}
      : { showReference: input.showReference }),
    ...(input.coverageFilter === undefined
      ? {}
      : { coverageFilter: input.coverageFilter }),
  };
  const changesConfiguration = Object.keys(input).some((key) => key !== 'name');
  if (changesConfiguration || unavailableMetrics(existing).length === 0) {
    const parsed = analyticsSavedViewConfigurationSchema.safeParse(merged);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Saved-view configuration is invalid');
    }
    validateSavedViewConfiguration(parsed.data);
  }
  const view = await prisma.analyticsSavedView.update({
    where: { id },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.primaryMetric === undefined
        ? {}
        : { primaryMetric: input.primaryMetric }),
      ...(input.comparisonMetric === undefined
        ? {}
        : { comparisonMetric: input.comparisonMetric }),
      ...(input.periodDays === undefined
        ? {}
        : { periodDays: input.periodDays }),
      ...(input.aggregation === undefined
        ? {}
        : { aggregation: input.aggregation }),
      ...(input.visualization === undefined
        ? {}
        : { visualization: input.visualization }),
      ...(input.showReference === undefined
        ? {}
        : { showReference: input.showReference }),
      ...(input.coverageFilter === undefined
        ? {}
        : { coverageFilter: input.coverageFilter }),
    },
  });
  return serializeSavedView(view);
}

export async function duplicateAnalyticsSavedView(
  userId: string,
  id: string,
): Promise<AnalyticsSavedView> {
  const source = await ownedSavedView(userId, id);
  const sortOrder = await prisma.analyticsSavedView.count({ where: { userId } });
  const view = await prisma.analyticsSavedView.create({
    data: {
      userId,
      name: `${source.name} copy`,
      primaryMetric: source.primaryMetric,
      comparisonMetric: source.comparisonMetric,
      periodDays: source.periodDays,
      aggregation: source.aggregation,
      visualization: source.visualization,
      showReference: source.showReference,
      coverageFilter: source.coverageFilter,
      sortOrder,
    },
  });
  return serializeSavedView(view);
}

export async function reorderAnalyticsSavedViews(
  userId: string,
  input: AnalyticsSavedViewOrderInput,
): Promise<AnalyticsSavedView[]> {
  const savedViews = await prisma.analyticsSavedView.findMany({
    where: { userId },
    select: { id: true },
  });
  if (
    savedViews.length !== input.ids.length ||
    savedViews.some((view) => !input.ids.includes(view.id))
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Saved-view order must include every owned saved view exactly once',
    );
  }
  await prisma.$transaction(
    input.ids.map((id, sortOrder) =>
      prisma.analyticsSavedView.update({ where: { id }, data: { sortOrder } }),
    ),
  );
  return listAnalyticsSavedViews(userId);
}

export async function deleteAnalyticsSavedView(
  userId: string,
  id: string,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.analyticsSavedView.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (existing === null) throw notFoundError('Analytics saved view');
    await transaction.analyticsPreference.updateMany({
      where: { userId, pinnedSavedViewId: id },
      data: { pinnedSavedViewId: null },
    });
    await transaction.analyticsSavedView.delete({ where: { id } });
    const remaining = await transaction.analyticsSavedView.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    await Promise.all(
      remaining.map((view, sortOrder) =>
        transaction.analyticsSavedView.update({
          where: { id: view.id },
          data: { sortOrder },
        }),
      ),
    );
  });
}

export async function getAnalyticsPreferences(
  userId: string,
): Promise<AnalyticsPreferenceValue> {
  const preference = await prisma.analyticsPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  return analyticsPreferenceValue(preference);
}

export async function updateAnalyticsPreferences(
  userId: string,
  input: AnalyticsPreferenceUpdateInput,
): Promise<AnalyticsPreferenceValue> {
  if (input.preferredSimpleMetric !== undefined) {
    if (!analyticsMetricForKey(input.preferredSimpleMetric).simpleAvailable) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Preferred Simple metric is unavailable in Simple mode',
      );
    }
  }
  if (input.pinnedSavedViewId !== undefined && input.pinnedSavedViewId !== null) {
    await requireComplexAnalyticsMode(userId);
    await ownedSavedView(userId, input.pinnedSavedViewId);
  }
  const preference = await prisma.analyticsPreference.upsert({
    where: { userId },
    update: {
      ...(input.preferredSimpleMetric === undefined
        ? {}
        : { preferredSimpleMetric: input.preferredSimpleMetric }),
      ...(input.pinnedSavedViewId === undefined
        ? {}
        : { pinnedSavedViewId: input.pinnedSavedViewId }),
    },
    create: {
      userId,
      preferredSimpleMetric: input.preferredSimpleMetric ?? 'calories',
      pinnedSavedViewId: input.pinnedSavedViewId ?? null,
    },
  });
  return analyticsPreferenceValue(preference);
}

import type {
  FoodItemServingOptions,
  FoodSourceProvider,
} from '@food-tracker/shared';
import { AppError } from '../../lib/errors.js';
import { findOrCreateUsdaFoodItem, type UsdaFdcConfig } from './usda-fdc.js';
import type { Prisma } from '@prisma/client';

export interface ExternalFoodMaterializationInput {
  sourceProvider: FoodSourceProvider;
  sourceId: string;
  config: UsdaFdcConfig;
  transaction: Prisma.TransactionClient;
  servingOptions?: FoodItemServingOptions | null;
}

export type ExternalFoodMaterializer = (
  input: ExternalFoodMaterializationInput,
) => ReturnType<typeof findOrCreateUsdaFoodItem>;

const materializers: Partial<
  Record<FoodSourceProvider, ExternalFoodMaterializer>
> = {
  usda_fdc: ({ sourceId, config, transaction, servingOptions }) =>
    findOrCreateUsdaFoodItem({
      sourceId,
      config,
      transaction,
      ...(servingOptions === undefined ? {} : { servingOptions }),
    }),
};

const inFlightMaterializations = new Map<string, Promise<unknown>>();

export function registerExternalFoodMaterializer(
  sourceProvider: FoodSourceProvider,
  materializer: ExternalFoodMaterializer,
): () => void {
  const previous = materializers[sourceProvider];
  materializers[sourceProvider] = materializer;
  return () => {
    if (previous === undefined) {
      delete materializers[sourceProvider];
    } else {
      materializers[sourceProvider] = previous;
    }
  };
}

export function withExternalFoodMaterializationLock<T>(input: {
  sourceProvider: FoodSourceProvider;
  sourceId: string;
  operation: () => Promise<T>;
}): Promise<T> {
  const key = `${input.sourceProvider}:${input.sourceId}`;
  const previous = inFlightMaterializations.get(key) ?? Promise.resolve();
  const operation = previous.then(input.operation, input.operation);
  inFlightMaterializations.set(key, operation);
  const clear = () => {
    if (inFlightMaterializations.get(key) === operation) {
      inFlightMaterializations.delete(key);
    }
  };
  operation.then(clear, clear);
  return operation;
}

export async function withExternalFoodMaterializationLocks<T>(input: {
  references: Array<{ sourceProvider: FoodSourceProvider; sourceId: string }>;
  operation: () => Promise<T>;
}): Promise<T> {
  const references = [
    ...new Map(
      input.references.map((reference) => [
        `${reference.sourceProvider}:${reference.sourceId}`,
        reference,
      ]),
    ).values(),
  ].sort((left, right) =>
    `${left.sourceProvider}:${left.sourceId}`.localeCompare(
      `${right.sourceProvider}:${right.sourceId}`,
    ),
  );

  const run = async (index: number): Promise<T> => {
    const reference = references[index];
    if (reference === undefined) return input.operation();
    return withExternalFoodMaterializationLock({
      ...reference,
      operation: () => run(index + 1),
    });
  };
  return run(0);
}

/**
 * Provider-neutral entry point for on-demand canonicalization. Provider
 * adapters own refetching and nutrition validation; callers never submit
 * provider nutrition or persist search results directly.
 */
export async function findOrCreateExternalFoodItem(
  input: ExternalFoodMaterializationInput,
) {
  const materializer = materializers[input.sourceProvider];
  if (materializer === undefined) {
    throw new AppError(
      422,
      'VALIDATION_ERROR',
      'This external food provider is not available for trusted logging.',
      { sourceProvider: input.sourceProvider },
    );
  }
  return materializer(input);
}

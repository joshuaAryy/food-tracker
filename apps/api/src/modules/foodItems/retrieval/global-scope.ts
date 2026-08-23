import { Prisma } from '@prisma/client';

/** Restricts semantic rehydration to the global catalog represented in Pinecone. */
export function globalSemanticFoodWhere(
  ids: readonly string[],
): Prisma.FoodItemWhereInput {
  return {
    id: { in: [...ids] },
    userId: null,
    sourceType: 'app_owned',
    archivedAt: null,
  };
}

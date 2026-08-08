import type { WaterLog, WaterLogInput } from '@food-tracker/shared';

export const QUICK_ADD_WATER_AMOUNT_ML = 250;

export interface WaterLogPersistence {
  create(input: WaterLogInput): Promise<WaterLog>;
  delete(id: string): Promise<{ id: string; deleted: true }>;
}

export function quickAddWater(
  waterLogs: WaterLogPersistence,
  loggedAt: Date,
): Promise<WaterLog> {
  return waterLogs.create({
    amountMl: QUICK_ADD_WATER_AMOUNT_ML,
    loggedAt: loggedAt.toISOString(),
  });
}

export function undoQuickAddWater(
  waterLogs: WaterLogPersistence,
  waterLogId: string,
): Promise<{ id: string; deleted: true }> {
  return waterLogs.delete(waterLogId);
}

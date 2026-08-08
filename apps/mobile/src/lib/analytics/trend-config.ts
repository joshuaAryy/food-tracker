import type { TrendQueryInput } from '@food-tracker/shared';

export type TrendDraft = TrendQueryInput;

export function createTrendDraft(active: TrendQueryInput): TrendDraft {
  return {
    ...active,
    period: { ...active.period },
  };
}

export function updateTrendDraft(
  draft: TrendDraft,
  changes: Partial<TrendDraft>,
): TrendDraft {
  return {
    ...draft,
    ...changes,
    period: changes.period === undefined ? draft.period : { ...changes.period },
  };
}

/** Apply is the only transition that can replace the active Trend query. */
export function applyTrendDraft(
  _active: TrendQueryInput,
  draft: TrendDraft,
): TrendQueryInput {
  return createTrendDraft(draft);
}

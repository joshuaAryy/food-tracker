import type {
  AiFoodParseExternalFood,
  AiFoodParsedItem,
  DefaultWholeItemServing,
  FoodItem,
  FoodItemServingOptions,
} from '@food-tracker/shared';
import { classifyServingUnit } from '@food-tracker/shared';
import {
  availableServingChoices,
  provisionalServingPreview,
  type ProvisionalServingPreview,
  type ServingPreviewBasis,
} from './serving-preview';

export type AiServingCandidate = FoodItem | AiFoodParseExternalFood;

export type AiServingInitialization =
  | 'parsed'
  | 'basis_default'
  | 'needs_review'
  | 'invalid';

export type AiServingState = {
  amount: string;
  unit: string;
  servingOptionId: string | null;
  initialization: AiServingInitialization;
  parsedQuantity?: number;
  wholeItemServingOptionId?: string | null;
  wholeItemServing?: DefaultWholeItemServing | null;
};

function candidateOptions(
  candidate: AiServingCandidate,
): FoodItemServingOptions | null {
  return 'servingOptions' in candidate ? candidate.servingOptions : null;
}

export function aiServingBasis(
  candidate: AiServingCandidate,
): ServingPreviewBasis {
  return {
    name: candidate.name,
    servingQuantity: candidate.servingQuantity,
    servingUnit: candidate.servingUnit,
    nutrition: {
      calories: candidate.calories,
      protein: candidate.protein,
      carbs: candidate.carbs,
      fat: candidate.fat,
      fiber: candidate.fiber,
      sugar: candidate.sugar,
      sodium: candidate.sodium,
      nutrients: candidate.nutrients,
    },
    servingOptions: candidateOptions(candidate),
  };
}

function amountFromSuggestion(item: AiFoodParsedItem): {
  amount: string;
  unit: string;
} {
  return {
    amount:
      item.servingSuggestion.quantity === null
        ? ''
        : String(item.servingSuggestion.quantity),
    unit: item.servingSuggestion.unit ?? '',
  };
}

function autoSelectedCountOption(
  unit: string,
  candidate: AiServingCandidate | null,
): string | null {
  if (candidate === null) return null;
  const requested = classifyServingUnit(unit);
  if (requested?.family !== 'count') return null;
  const basis = classifyServingUnit(candidate.servingUnit ?? '');
  if (basis?.unit === requested.unit) return null;
  const matches = (candidateOptions(candidate)?.options ?? []).filter(
    (option) => classifyServingUnit(option.unit)?.unit === requested.unit,
  );
  return matches.length === 1 ? (matches[0]?.id ?? null) : null;
}

function physicalWholeItemState(
  quantity: number,
  serving: DefaultWholeItemServing | null | undefined,
): Pick<
  AiServingState,
  | 'amount'
  | 'unit'
  | 'servingOptionId'
  | 'parsedQuantity'
  | 'wholeItemServingOptionId'
  | 'wholeItemServing'
> | null {
  if (serving === null || serving === undefined || serving.quantity <= 0) {
    return null;
  }
  if (serving.equivalentWeightGrams !== null) {
    return {
      amount: String(
        (quantity / serving.quantity) * serving.equivalentWeightGrams,
      ),
      unit: 'g',
      servingOptionId: null,
      parsedQuantity: quantity,
      wholeItemServingOptionId: serving.optionId,
      wholeItemServing: serving,
    };
  }
  if (serving.equivalentVolumeMl !== null) {
    return {
      amount: String(
        (quantity / serving.quantity) * serving.equivalentVolumeMl,
      ),
      unit: 'ml',
      servingOptionId: null,
      parsedQuantity: quantity,
      wholeItemServingOptionId: serving.optionId,
      wholeItemServing: serving,
    };
  }
  return null;
}

export function initialAiServingState(
  item: AiFoodParsedItem,
  candidate: AiServingCandidate | null,
): AiServingState {
  if (item.servingSuggestion.status === 'missing') {
    return {
      amount:
        candidate?.servingQuantity === null ||
        candidate?.servingQuantity === undefined
          ? ''
          : String(candidate.servingQuantity),
      unit: candidate?.servingUnit ?? '',
      servingOptionId: null,
      initialization: 'basis_default',
    };
  }

  if (
    item.servingSuggestion.unit === null &&
    item.servingSuggestion.quantity !== null
  ) {
    const physical = physicalWholeItemState(
      item.servingSuggestion.quantity,
      candidate?.defaultWholeItemServing,
    );
    if (physical !== null) return { ...physical, initialization: 'parsed' };
    if (
      candidate?.servingUnit &&
      classifyServingUnit(candidate.servingUnit)?.family === 'count'
    )
      return {
        amount: String(item.servingSuggestion.quantity),
        unit: classifyServingUnit(candidate.servingUnit)!.unit,
        servingOptionId: null,
        initialization: 'basis_default',
        parsedQuantity: item.servingSuggestion.quantity,
        wholeItemServingOptionId: null,
        wholeItemServing: null,
      };
    return {
      amount: String(item.servingSuggestion.quantity),
      unit: '',
      servingOptionId: null,
      initialization: 'needs_review',
      parsedQuantity: item.servingSuggestion.quantity,
      wholeItemServingOptionId: null,
      wholeItemServing: null,
    };
  }

  const suggested = amountFromSuggestion(item);
  if (
    item.servingSuggestion.status === 'parsed' &&
    item.servingSuggestion.quantity !== null &&
    classifyServingUnit(suggested.unit)?.family === 'count'
  ) {
    const physical = physicalWholeItemState(
      item.servingSuggestion.quantity,
      candidate?.defaultWholeItemServing,
    );
    if (physical !== null) return { ...physical, initialization: 'parsed' };
  }
  return {
    ...suggested,
    servingOptionId:
      item.servingSuggestion.status === 'parsed'
        ? autoSelectedCountOption(suggested.unit, candidate)
        : null,
    initialization:
      item.servingSuggestion.status === 'parsed'
        ? 'parsed'
        : item.servingSuggestion.status,
  };
}

export function changeAiCandidateServing(
  previous: AiServingState,
  candidate: AiServingCandidate,
): AiServingState {
  if (previous.parsedQuantity !== undefined) {
    const physical = physicalWholeItemState(
      previous.parsedQuantity,
      candidate.defaultWholeItemServing,
    );
    if (physical !== null)
      return { ...previous, ...physical, initialization: 'parsed' };
    return {
      ...previous,
      amount: String(previous.parsedQuantity),
      unit: '',
      servingOptionId: null,
      wholeItemServingOptionId: null,
      wholeItemServing: null,
      initialization: 'needs_review',
    };
  }
  const optionStillAvailable = availableServingChoices(
    aiServingBasis(candidate),
  ).some((choice) => choice.servingOptionId === previous.servingOptionId);

  return {
    ...previous,
    servingOptionId:
      previous.servingOptionId !== null && optionStillAvailable
        ? previous.servingOptionId
        : autoSelectedCountOption(previous.unit, candidate),
  };
}

export function aiServingPreview(
  candidate: AiServingCandidate | null,
  state: AiServingState,
): ProvisionalServingPreview | null {
  if (candidate === null) return null;

  return provisionalServingPreview({
    basis: aiServingBasis(candidate),
    request: {
      quantityText: state.amount,
      unit: state.unit,
      ...(state.servingOptionId === null
        ? {}
        : { servingOptionId: state.servingOptionId }),
    },
  });
}

export function availableAiServingChoices(
  candidate: AiServingCandidate,
  state: AiServingState,
) {
  const choices = availableServingChoices(aiServingBasis(candidate));
  if (
    state.wholeItemServingOptionId === undefined ||
    state.wholeItemServingOptionId === null
  ) {
    return choices;
  }
  return choices.filter(
    (choice) => choice.servingOptionId !== state.wholeItemServingOptionId,
  );
}

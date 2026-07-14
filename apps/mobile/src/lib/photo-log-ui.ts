import type {
  AiFoodParseCandidate,
  AiFoodParseExternalFood,
  FoodItem,
  FoodLogsFromCandidatesInput,
  MealType,
  PhotoAnalysisResult,
  PhotoRecognizedItem,
  TrackingMode,
} from '@food-tracker/shared';
import { aiServingBasis, type AiServingCandidate } from './ai-serving';
import {
  availableServingChoices,
  provisionalServingPreview,
  type ProvisionalServingPreview,
  type ServingChoice,
} from './serving-preview';

export type PhotoReviewStatus = 'pending' | 'confirmed' | 'excluded';

export interface PhotoLibraryPermissionLike {
  granted: boolean;
  canAskAgain: boolean;
  accessPrivileges?: 'all' | 'limited' | 'none';
}

export type PhotoLibraryPermissionDecision =
  | {
      status: 'granted';
      access: 'all' | 'limited';
      permission: PhotoLibraryPermissionLike;
    }
  | {
      status: 'denied';
      canAskAgain: boolean;
      permission: PhotoLibraryPermissionLike;
    };

function photoLibraryPermissionIsUsable(
  permission: PhotoLibraryPermissionLike,
): permission is PhotoLibraryPermissionLike & {
  accessPrivileges: 'all' | 'limited';
} {
  return (
    permission.granted === true ||
    permission.accessPrivileges === 'all' ||
    permission.accessPrivileges === 'limited'
  );
}

/**
 * Resolves read-only photo-library access without ever requesting write access.
 * This is kept injectable so permission and cancellation behavior can be
 * tested without bypassing the production decision path.
 */
export async function ensurePhotoLibraryPermission(input: {
  get: (writeOnly: false) => Promise<PhotoLibraryPermissionLike>;
  request: (writeOnly: false) => Promise<PhotoLibraryPermissionLike>;
}): Promise<PhotoLibraryPermissionDecision> {
  const current = await input.get(false);
  if (photoLibraryPermissionIsUsable(current)) {
    return {
      status: 'granted',
      access: current.accessPrivileges ?? 'all',
      permission: current,
    };
  }

  if (!current.canAskAgain) {
    return { status: 'denied', canAskAgain: false, permission: current };
  }

  const requested = await input.request(false);
  if (photoLibraryPermissionIsUsable(requested)) {
    return {
      status: 'granted',
      access: requested.accessPrivileges ?? 'all',
      permission: requested,
    };
  }
  return {
    status: 'denied',
    canAskAgain: requested.canAskAgain,
    permission: requested,
  };
}

export interface PhotoReviewRow {
  id: string;
  recognizedItem: PhotoRecognizedItem;
  selectedCandidateId: string | null;
  amount: string;
  unit: string;
  servingOptionId: string | null;
  candidateReviewed: boolean;
  status: PhotoReviewStatus;
  addedByUser: boolean;
}

export function photoCandidateId(candidate: AiFoodParseCandidate): string {
  return candidate.candidateType === 'food_item'
    ? candidate.foodItem.id
    : `${candidate.externalFood.sourceProvider}:${candidate.externalFood.sourceId}`;
}

export function photoCandidateFood(
  candidate: AiFoodParseCandidate | null,
): AiServingCandidate | null {
  if (candidate === null) return null;
  return candidate.candidateType === 'food_item'
    ? candidate.foodItem
    : candidate.externalFood;
}

export function selectedPhotoCandidate(
  row: PhotoReviewRow,
): AiFoodParseCandidate | null {
  if (row.selectedCandidateId === null) return null;
  return (
    row.recognizedItem.candidates.find(
      (candidate) => photoCandidateId(candidate) === row.selectedCandidateId,
    ) ?? null
  );
}

function initialServing(
  row: PhotoRecognizedItem,
  candidate: AiServingCandidate | null,
) {
  const parsed = row.provisionalPortion?.parsed;
  if (
    parsed?.status === 'parsed' &&
    parsed.quantity !== null &&
    parsed.unit !== null
  ) {
    return {
      amount: String(parsed.quantity),
      unit: parsed.unit,
      servingOptionId: null,
    };
  }
  return {
    amount:
      candidate?.servingQuantity === null ||
      candidate?.servingQuantity === undefined
        ? ''
        : String(candidate.servingQuantity),
    unit: candidate?.servingUnit ?? '',
    servingOptionId: null,
  };
}

export function photoRowsFromAnalysis(
  result: PhotoAnalysisResult,
): PhotoReviewRow[] {
  return result.items.map((item) => {
    const selectedCandidateId = item.selectedCandidateId;
    const candidate =
      selectedCandidateId === null
        ? null
        : (item.candidates.find(
            (value) => photoCandidateId(value) === selectedCandidateId,
          ) ?? null);
    const serving = initialServing(item, photoCandidateFood(candidate));
    return {
      id: item.id,
      recognizedItem: item,
      selectedCandidateId,
      ...serving,
      candidateReviewed: false,
      status: 'pending',
      addedByUser: false,
    };
  });
}

export function photoRowServingPreview(
  row: PhotoReviewRow,
): ProvisionalServingPreview | null {
  const candidate = photoCandidateFood(selectedPhotoCandidate(row));
  if (candidate === null) return null;
  return provisionalServingPreview({
    basis: aiServingBasis(candidate),
    request: {
      quantityText: row.amount,
      unit: row.unit,
      servingOptionId: row.servingOptionId,
    },
  });
}

export function photoRowServingChoices(row: PhotoReviewRow): ServingChoice[] {
  const candidate = photoCandidateFood(selectedPhotoCandidate(row));
  return candidate === null
    ? []
    : availableServingChoices(aiServingBasis(candidate));
}

export function photoRowReason(row: PhotoReviewRow): string | null {
  if (row.status === 'excluded') return null;
  if (selectedPhotoCandidate(row) === null) return 'Choose a trusted food.';
  if (!row.candidateReviewed) return 'Review and confirm the trusted match.';
  const preview = photoRowServingPreview(row);
  if (preview === null) return 'Choose a trusted food.';
  if (preview.status !== 'exact' && preview.status !== 'converted') {
    return preview.message;
  }
  return null;
}

export function confirmPhotoRow(row: PhotoReviewRow): PhotoReviewRow {
  const next = { ...row, candidateReviewed: true };
  return photoRowReason(next) === null
    ? { ...next, status: 'confirmed' }
    : { ...next, status: 'pending' };
}

export function setPhotoRowIncluded(
  row: PhotoReviewRow,
  included: boolean,
): PhotoReviewRow {
  return included
    ? { ...row, status: 'pending' }
    : { ...row, status: 'excluded' };
}

export function replacePhotoRowCandidate(
  row: PhotoReviewRow,
  candidate: AiFoodParseCandidate,
): PhotoReviewRow {
  const nextItem = {
    ...row.recognizedItem,
    selectedCandidateId: photoCandidateId(candidate),
    unresolvedReason: null,
  };
  const currentChoices = availableServingChoices(
    aiServingBasis(photoCandidateFood(candidate)!),
  );
  const currentChoice = currentChoices.find(
    (choice) =>
      choice.unit === row.unit &&
      choice.servingOptionId === row.servingOptionId,
  );
  const fallback = initialServing(nextItem, photoCandidateFood(candidate));
  return {
    ...row,
    recognizedItem: nextItem,
    selectedCandidateId: photoCandidateId(candidate),
    ...(currentChoice === undefined ? fallback : {}),
    candidateReviewed: false,
    status: 'pending',
  };
}

export function addPhotoRow(
  candidate: AiFoodParseCandidate,
  index: number,
): PhotoReviewRow {
  const id = `photo-item-${index + 1}` as PhotoRecognizedItem['id'];
  const food = photoCandidateFood(candidate)!;
  const item: PhotoRecognizedItem = {
    id,
    recognizedName: food.name,
    preparationForm: null,
    identityConfidence: 'high',
    portionConfidence: null,
    region: null,
    provisionalPortion: null,
    reviewStatus: 'needs_review',
    selectedCandidateId: photoCandidateId(candidate),
    loggable: false,
    candidates: [candidate],
    unresolvedReason: null,
  };
  const serving = initialServing(item, food);
  return {
    id,
    recognizedItem: item,
    selectedCandidateId: photoCandidateId(candidate),
    ...serving,
    candidateReviewed: true,
    status: 'pending',
    addedByUser: true,
  };
}

export interface PhotoRowsDisposition {
  canContinue: boolean;
  included: PhotoReviewRow[];
  blockedReasons: Record<string, string>;
}

export function photoRowsDisposition(
  rows: PhotoReviewRow[],
): PhotoRowsDisposition {
  const blockedReasons: Record<string, string> = {};
  const included = rows.filter((row) => row.status === 'confirmed');
  for (const row of rows) {
    const reason = photoRowReason(row);
    if (row.status === 'pending') {
      blockedReasons[row.id] = reason ?? 'Confirm this row or exclude it.';
    }
    if (row.status === 'confirmed' && reason !== null)
      blockedReasons[row.id] = reason;
  }
  if (included.length === 0)
    blockedReasons._selection = 'Confirm at least one food to continue.';
  return {
    canContinue:
      included.length > 0 && Object.keys(blockedReasons).length === 0,
    included,
    blockedReasons,
  };
}

export function photoRowsSaveRequest(input: {
  rows: PhotoReviewRow[];
  mealType: MealType;
  loggedAt: string;
  notes?: string | null;
}): FoodLogsFromCandidatesInput {
  const disposition = photoRowsDisposition(input.rows);
  if (!disposition.canContinue) {
    throw new Error(
      'Every included photo row must be confirmed before saving.',
    );
  }
  return {
    mealType: input.mealType,
    loggedAt: input.loggedAt,
    ...(input.notes === undefined ? {} : { notes: input.notes }),
    items: disposition.included.map((row) => {
      const candidate = selectedPhotoCandidate(row);
      const preview = photoRowServingPreview(row);
      if (
        candidate === null ||
        preview === null ||
        preview.requestedServing === null
      ) {
        throw new Error('A confirmed photo row is missing a trusted serving.');
      }
      const serving = preview.requestedServing;
      return candidate.candidateType === 'food_item'
        ? {
            candidateType: 'food_item' as const,
            foodItemId: candidate.foodItem.id,
            serving,
          }
        : {
            candidateType: 'external_food' as const,
            sourceProvider: candidate.externalFood.sourceProvider,
            sourceId: candidate.externalFood.sourceId,
            serving,
          };
    }),
  };
}

export function photoNutritionProjection(
  row: PhotoReviewRow,
  mode: TrackingMode,
): {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  nutrients: Record<string, { amount: number; unit: string }>;
} | null {
  const preview = photoRowServingPreview(row);
  if (preview === null || preview.nutrition === null) return null;
  return {
    calories: preview.nutrition.calories,
    protein: preview.nutrition.protein,
    carbs: mode === 'complex' ? preview.nutrition.carbs : null,
    fat: mode === 'complex' ? preview.nutrition.fat : null,
    nutrients: mode === 'complex' ? preview.nutrition.nutrients : {},
  };
}

export function photoCandidateSourceLabel(
  candidate: AiFoodParseCandidate | null,
): string {
  if (candidate === null) return 'No trusted match';
  if (candidate.candidateType === 'external_food') {
    return `USDA · ${candidate.externalFood.servingBasisText}`;
  }
  return candidate.foodItem.sourceProvider ?? 'Trusted FoodItem';
}

export function photoCandidateName(
  candidate: AiFoodParseCandidate | null,
): string {
  if (candidate === null) return 'Choose a trusted food';
  return candidate.candidateType === 'food_item'
    ? candidate.foodItem.name
    : candidate.externalFood.name;
}

export function photoCandidateFromRow(
  row: PhotoReviewRow,
): AiFoodParseCandidate | null {
  return selectedPhotoCandidate(row);
}

export type { AiFoodParseExternalFood, FoodItem };

import type {
  AiFoodParseCandidate,
  AiFoodParseExternalFood,
  FoodItem,
  FoodLogsFromCandidatesInput,
  MealType,
  PhotoAnalysisConfirmationInput,
  PhotoAnalysisResult,
  PhotoNutritionEstimate,
  PhotoRecognizedItem,
  TrackingMode,
} from '@food-tracker/shared';
import {
  PHOTO_ANALYSIS_MAX_ITEMS,
  PHOTO_NUTRITION_ESTIMATE_ENERGY_TOLERANCE_KCAL,
  PHOTO_NUTRITION_ESTIMATE_ENERGY_TOLERANCE_RATIO,
  PHOTO_NUTRITION_ESTIMATE_MAX_CALORIES,
  PHOTO_NUTRITION_ESTIMATE_MAX_MACRO_GRAMS,
  photoAnalysisConfirmationInputSchema,
} from '@food-tracker/shared';
import { aiServingBasis, type AiServingCandidate } from './ai-serving';
import {
  availableServingChoices,
  changeServingChoice,
  convertServingAmountForUnitChange,
  provisionalServingPreview,
  type ProvisionalServingPreview,
  type ServingChoice,
  type ServingChoiceState,
} from './serving-preview';

export type PhotoReviewStatus = 'pending' | 'confirmed' | 'excluded';
export type PhotoReviewDisposition =
  | 'trusted'
  | 'estimated'
  | 'excluded'
  | 'unresolved';

export type PhotoRowLabelSource =
  | 'trusted_food_item'
  | 'external_candidate'
  | 'ai_estimate'
  | 'unresolved_recognition'
  | 'fallback_recognition';

export type PhotoEstimateField =
  | 'foodName'
  | 'calories'
  | 'proteinGrams'
  | 'carbohydrateGrams'
  | 'fatGrams';

export interface PhotoEstimateDraft {
  foodName: string;
  calories: string;
  proteinGrams: string;
  carbohydrateGrams: string;
  fatGrams: string;
}

export type PhotoEstimateFieldErrors = Partial<
  Record<PhotoEstimateField, string>
>;

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
  servingReviewed?: boolean | undefined;
  status: PhotoReviewStatus;
  disposition: PhotoReviewDisposition;
  excludedDisposition?: Exclude<PhotoReviewDisposition, 'excluded'> | undefined;
  estimateDraft?: PhotoEstimateDraft | undefined;
  estimateUnavailableReason?: string | undefined;
  estimateProofUnavailable?: boolean | undefined;
  addedByUser: boolean;
}

export type PhotoExternalResolutionState =
  | 'none'
  | 'available'
  | 'materializing'
  | 'failed'
  | 'unavailable'
  | 'trusted';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function photoCandidateIsMixedCompatible(
  candidate: AiFoodParseCandidate | null,
): candidate is Extract<AiFoodParseCandidate, { candidateType: 'food_item' }> {
  return (
    candidate?.candidateType === 'food_item' &&
    UUID_PATTERN.test(candidate.foodItem.id)
  );
}

export function photoCandidateId(candidate: AiFoodParseCandidate): string {
  return candidate.candidateType === 'food_item'
    ? candidate.foodItem.id
    : `${candidate.externalFood.sourceProvider}:${candidate.externalFood.sourceId}`;
}

/** Replace an external review candidate with the canonical backend FoodItem
 * returned by on-demand provider resolution. Provider nutrition never enters
 * the review/save contract from the client. */
export function materializePhotoCandidate(
  candidate: Extract<AiFoodParseCandidate, { candidateType: 'external_food' }>,
  foodItem: FoodItem,
): Extract<AiFoodParseCandidate, { candidateType: 'food_item' }> {
  return {
    candidateType: 'food_item',
    foodItem,
    externalFood: null,
    rank: candidate.rank,
    matchReason: candidate.matchReason,
    confidence: candidate.confidence,
    defaultServingMultiplier: candidate.defaultServingMultiplier,
  };
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

export function photoExternalResolutionState(
  row: PhotoReviewRow,
  transient: { resolving?: boolean; failure?: string | null | undefined } = {},
): PhotoExternalResolutionState {
  const candidate = selectedPhotoCandidate(row);
  if (photoCandidateIsMixedCompatible(candidate)) return 'trusted';
  if (candidate?.candidateType !== 'external_food') return 'none';
  if (transient.resolving === true) return 'materializing';
  if ((transient.failure?.trim().length ?? 0) > 0) return 'failed';
  const food = candidate.externalFood;
  return food.calories !== null &&
    food.protein !== null &&
    food.servingQuantity !== null &&
    food.servingQuantity > 0 &&
    food.servingUnit !== null &&
    food.servingUnit.trim() !== ''
    ? 'available'
    : 'unavailable';
}

function estimateProofIsUsable(estimate: PhotoNutritionEstimate | undefined) {
  return (estimate?.estimateProof?.trim().length ?? 0) > 0;
}

function estimateDraftFromRow(
  row: Pick<PhotoRecognizedItem, 'recognizedName' | 'estimatedNutrition'>,
): PhotoEstimateDraft | undefined {
  const estimate = row.estimatedNutrition;
  if (estimate === undefined) return undefined;
  return {
    foodName: row.recognizedName,
    calories: String(estimate.calories),
    proteinGrams: String(estimate.proteinGrams),
    carbohydrateGrams: String(estimate.carbohydrateGrams),
    fatGrams: String(estimate.fatGrams),
  };
}

function trustedDefaultForItem(
  item: PhotoRecognizedItem,
  candidate: AiFoodParseCandidate | null,
): boolean {
  if (!photoCandidateIsMixedCompatible(candidate)) return false;
  if (item.adjudication === undefined) {
    return (
      item.identityConfidence === 'high' && candidate.confidence === 'high'
    );
  }
  if (
    item.adjudication.selectionSource === 'deterministic' &&
    (item.adjudication.status === 'not_needed' ||
      (item.adjudication.status === 'selected' &&
        item.adjudication.confidence === 'high'))
  ) {
    return (
      item.identityConfidence === 'high' && candidate.confidence === 'high'
    );
  }
  return (
    item.adjudication.selectionSource === 'ai_adjudicated' &&
    item.adjudication.status === 'selected' &&
    item.adjudication.confidence === 'high' &&
    candidate.confidence === 'high'
  );
}

function initialServing(
  row: PhotoRecognizedItem,
  candidate: AiServingCandidate | null,
) {
  const resolved = row.provisionalPortion?.resolvedServing;
  if (
    resolved?.servingOptionId !== null &&
    resolved?.servingOptionId !== undefined &&
    resolved.quantity !== null &&
    resolved.quantity !== undefined &&
    resolved.unit !== null
  ) {
    return {
      amount: String(resolved.quantity),
      unit: resolved.unit,
      servingOptionId: resolved.servingOptionId,
    };
  }
  if (
    resolved?.normalizedGrams !== null &&
    resolved?.normalizedGrams !== undefined
  ) {
    return {
      amount: String(resolved.normalizedGrams),
      unit: 'g',
      servingOptionId: null,
    };
  }
  if (
    resolved?.quantity !== null &&
    resolved?.quantity !== undefined &&
    resolved.unit !== null &&
    ['g', 'kg', 'oz', 'lb'].includes(resolved.unit)
  ) {
    return {
      amount: String(resolved.quantity),
      unit: resolved.unit,
      servingOptionId: resolved.servingOptionId,
    };
  }
  const parsed = row.provisionalPortion?.parsed;
  if (
    parsed?.status === 'parsed' &&
    parsed.quantity !== null &&
    parsed.unit !== null &&
    ['g', 'kg', 'oz', 'lb'].includes(parsed.unit)
  ) {
    return {
      amount: String(parsed.quantity),
      unit: parsed.unit,
      servingOptionId: null,
    };
  }
  if (row.provisionalPortion !== null) {
    return {
      amount: '',
      unit: 'g',
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
    const trusted = trustedDefaultForItem(item, candidate);
    const disposition = trusted
      ? ('trusted' as const)
      : estimateProofIsUsable(item.estimatedNutrition)
        ? ('estimated' as const)
        : ('unresolved' as const);
    const row: PhotoReviewRow = {
      id: item.id,
      recognizedItem: item,
      selectedCandidateId,
      ...serving,
      candidateReviewed: trusted,
      servingReviewed: false,
      status: 'pending',
      disposition,
      estimateDraft: estimateDraftFromRow(item),
      addedByUser: false,
    };
    const preview = trusted ? photoRowServingPreview(row) : null;
    const amountValid =
      preview?.status === 'exact' || preview?.status === 'converted';
    return {
      ...row,
      servingReviewed: amountValid,
      status: trusted && amountValid ? 'confirmed' : 'pending',
    };
  });
}

export function photoRowLabelSource(row: PhotoReviewRow): PhotoRowLabelSource {
  if (row.disposition === 'estimated') return 'ai_estimate';
  const candidate = selectedPhotoCandidate(row);
  if (candidate?.candidateType === 'food_item') return 'trusted_food_item';
  if (candidate?.candidateType === 'external_food') {
    return 'external_candidate';
  }
  return row.recognizedItem.recognizedName.trim() === ''
    ? 'fallback_recognition'
    : 'unresolved_recognition';
}

export function photoRowDisplayName(row: PhotoReviewRow): string {
  if (row.disposition === 'estimated') {
    return row.estimateDraft?.foodName ?? row.recognizedItem.recognizedName;
  }
  const candidate = selectedPhotoCandidate(row);
  return row.disposition === 'trusted' && candidate !== null
    ? photoCandidateName(candidate)
    : row.recognizedItem.recognizedName;
}

export function photoRowStatusLabel(row: PhotoReviewRow): string {
  switch (photoRowLabelSource(row)) {
    case 'trusted_food_item':
      return 'Trusted match';
    case 'external_candidate':
      return photoExternalResolutionState(row) === 'available'
        ? 'External match · ready to use'
        : 'External match · temporarily unavailable';
    case 'ai_estimate':
      return 'AI estimate · low trust';
    case 'fallback_recognition':
      return 'Needs review · no usable recognition';
    case 'unresolved_recognition':
      return 'Needs review · recognition only';
  }
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
  if (candidate === null) return [];
  return availableServingChoices(aiServingBasis(candidate));
}

export function changePhotoServingChoice(
  row: PhotoReviewRow,
  choice: ServingChoice,
): ServingChoiceState & { error?: string } {
  if (choice.servingOptionId !== null) {
    return {
      amount:
        choice.quantity === undefined ? row.amount : String(choice.quantity),
      unit: choice.unit,
      servingOptionId: choice.servingOptionId,
    };
  }

  const preview = photoRowServingPreview(row);
  if (preview?.status === 'exact' || preview?.status === 'converted') {
    if (preview.resolvedWeightGrams !== null) {
      const converted = convertServingAmountForUnitChange({
        amount: preview.resolvedWeightGrams,
        fromUnit: 'g',
        toUnit: choice.unit,
      });
      if (converted.kind === 'converted') {
        return {
          amount: converted.displayText,
          unit: choice.unit,
          servingOptionId: null,
        };
      }
    }
  }

  return changeServingChoice(
    {
      amount: row.amount,
      unit: row.unit,
      servingOptionId: row.servingOptionId,
    },
    choice,
  );
}

export function photoRowReason(row: PhotoReviewRow): string | null {
  if (row.status === 'excluded') return null;
  if (row.disposition === 'unresolved') {
    const candidate = selectedPhotoCandidate(row);
    if (
      candidate?.candidateType === 'external_food' &&
      (candidate.externalFood.calories === null ||
        candidate.externalFood.protein === null)
    ) {
      return 'External food details were unavailable before the lookup deadline. Choose another trusted food, use the estimate, or exclude this row.';
    }
    return (
      row.estimateUnavailableReason ??
      'Choose a compatible trusted food, use a valid AI estimate, or exclude this row.'
    );
  }
  if (row.disposition === 'estimated') {
    if (row.estimateProofUnavailable === true) {
      return row.estimateUnavailableReason ?? 'This estimate is unavailable.';
    }
    if (!estimateProofIsUsable(row.recognizedItem.estimatedNutrition)) {
      return 'This estimate is unavailable. Analyze the photo again or exclude this row.';
    }
    const errors = photoEstimateValidation(row);
    return Object.values(errors)[0] ?? null;
  }
  const candidate = selectedPhotoCandidate(row);
  if (!photoCandidateIsMixedCompatible(candidate)) {
    return 'This match is not compatible with the mixed save. Choose another saved trusted food or use the estimate.';
  }
  const preview = photoRowServingPreview(row);
  if (preview === null) return 'Choose a trusted food.';
  if (preview.status !== 'exact' && preview.status !== 'converted') {
    return preview.message;
  }
  return null;
}

export function confirmPhotoRow(row: PhotoReviewRow): PhotoReviewRow {
  if (row.disposition !== 'trusted') return row;
  const candidateConfirmed = { ...row, candidateReviewed: true };
  const preview = photoRowServingPreview(candidateConfirmed);
  const servingConfirmed =
    preview?.status === 'exact' || preview?.status === 'converted';
  const next = {
    ...candidateConfirmed,
    servingReviewed:
      servingConfirmed || row.servingReviewed === true
        ? true
        : row.servingReviewed,
  };
  return photoRowReason(next) === null
    ? { ...next, status: 'confirmed' }
    : { ...next, status: 'pending' };
}

export function setPhotoRowIncluded(
  row: PhotoReviewRow,
  included: boolean,
): PhotoReviewRow {
  return included
    ? restorePhotoRow(row)
    : setPhotoRowDisposition(row, 'excluded');
}

export function setPhotoRowDisposition(
  row: PhotoReviewRow,
  disposition: PhotoReviewDisposition,
): PhotoReviewRow {
  if (disposition === 'excluded') {
    return {
      ...row,
      disposition,
      excludedDisposition:
        row.disposition === 'excluded'
          ? row.excludedDisposition
          : row.disposition,
      status: 'excluded',
    };
  }
  if (
    disposition === 'trusted' &&
    !photoCandidateIsMixedCompatible(selectedPhotoCandidate(row))
  ) {
    return {
      ...row,
      disposition: 'unresolved',
      status: 'pending',
      estimateUnavailableReason:
        'Choose a compatible saved trusted match before using trusted review.',
    };
  }
  if (
    disposition === 'estimated' &&
    (row.estimateProofUnavailable === true ||
      !estimateProofIsUsable(row.recognizedItem.estimatedNutrition))
  ) {
    return {
      ...row,
      disposition: 'unresolved',
      status: 'pending',
      estimateUnavailableReason:
        'This estimate has no usable server proof. Analyze the photo again or exclude this row.',
    };
  }
  return {
    ...row,
    disposition,
    status: 'pending',
    ...(row.estimateUnavailableReason === undefined
      ? {}
      : { estimateUnavailableReason: undefined }),
  };
}

export function restorePhotoRow(row: PhotoReviewRow): PhotoReviewRow {
  const restored = row.excludedDisposition ?? 'unresolved';
  return setPhotoRowDisposition(row, restored);
}

export function markPhotoRowUnresolved(
  row: PhotoReviewRow,
  reason: string,
  options: { estimateProofUnavailable?: boolean } = {},
): PhotoReviewRow {
  return {
    ...row,
    disposition: 'unresolved',
    status: 'pending',
    estimateUnavailableReason: reason,
    ...(options.estimateProofUnavailable === true
      ? { estimateProofUnavailable: true }
      : {}),
  };
}

export function replacePhotoRowCandidate(
  row: PhotoReviewRow,
  candidate: AiFoodParseCandidate,
): PhotoReviewRow {
  const previousCandidate = selectedPhotoCandidate(row);
  const backendMaterializedExternal =
    candidate.candidateType === 'food_item' &&
    candidate.foodItem.sourceType === 'cached_external' &&
    candidate.foodItem.sourceProvider !== null;
  const candidateId = photoCandidateId(candidate);
  const previousCandidateId =
    previousCandidate === null ? null : photoCandidateId(previousCandidate);
  const sameMaterializedExternal = (existing: AiFoodParseCandidate) =>
    candidate.candidateType === 'food_item' &&
    existing.candidateType === 'external_food' &&
    candidate.foodItem.sourceProvider ===
      existing.externalFood.sourceProvider &&
    candidate.foodItem.sourceId !== null &&
    candidate.foodItem.sourceId === existing.externalFood.sourceId;
  const retainedCandidates = backendMaterializedExternal
    ? row.recognizedItem.candidates.filter(
        (existing) =>
          photoCandidateId(existing) !== previousCandidateId &&
          !sameMaterializedExternal(existing),
      )
    : row.recognizedItem.candidates;
  const candidates = retainedCandidates.some(
    (existing) => photoCandidateId(existing) === candidateId,
  )
    ? retainedCandidates
    : [...retainedCandidates, candidate];
  const nextProvisionalPortion =
    row.recognizedItem.provisionalPortion === null
      ? null
      : { ...row.recognizedItem.provisionalPortion };
  if (nextProvisionalPortion !== null) {
    delete nextProvisionalPortion.resolvedServing;
  }
  const nextItem = {
    ...row.recognizedItem,
    selectedCandidateId: candidateId,
    unresolvedReason: null,
    candidates,
    provisionalPortion: nextProvisionalPortion,
  };
  if (backendMaterializedExternal) {
    delete nextItem.estimatedNutrition;
  }
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
    selectedCandidateId: candidateId,
    ...(currentChoice === undefined ? fallback : {}),
    candidateReviewed: photoCandidateIsMixedCompatible(candidate),
    servingReviewed: false,
    status:
      backendMaterializedExternal && nextItem.loggable === true
        ? 'confirmed'
        : 'pending',
    disposition: photoCandidateIsMixedCompatible(candidate)
      ? 'trusted'
      : estimateProofIsUsable(row.recognizedItem.estimatedNutrition)
        ? 'estimated'
        : 'unresolved',
    ...(backendMaterializedExternal
      ? { estimateDraft: undefined, estimateUnavailableReason: undefined }
      : {}),
    ...(row.estimateUnavailableReason === undefined
      ? {}
      : { estimateUnavailableReason: undefined }),
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
    representationGroupId: `photo-group-manual-${index + 1}`,
    representationKind: 'composite',
    active: true,
    coverage: [food.name],
    excludedCoverage: [],
    visiblePortionDescription: null,
  };
  const serving = initialServing(item, food);
  return {
    id,
    recognizedItem: item,
    selectedCandidateId: photoCandidateId(candidate),
    ...serving,
    candidateReviewed: true,
    servingReviewed: true,
    status: 'pending',
    disposition: photoCandidateIsMixedCompatible(candidate)
      ? 'trusted'
      : 'unresolved',
    addedByUser: true,
  };
}

export interface PhotoRowsDisposition {
  canContinue: boolean;
  included: PhotoReviewRow[];
  blockedReasons: Record<string, string>;
  excluded: PhotoReviewRow[];
  unresolved: PhotoReviewRow[];
}

export function photoRowsDisposition(
  rows: PhotoReviewRow[],
): PhotoRowsDisposition {
  const blockedReasons: Record<string, string> = {};
  const included: PhotoReviewRow[] = [];
  const excluded = rows.filter(
    (row) => row.disposition === 'excluded' || row.status === 'excluded',
  );
  const unresolved: PhotoReviewRow[] = [];
  for (const row of rows) {
    const reason = photoRowReason(row);
    if (row.disposition === 'excluded' || row.status === 'excluded') continue;
    if (reason === null) included.push(row);
    else {
      unresolved.push(row);
      blockedReasons[row.id] = reason;
    }
  }
  if (included.length === 0 && excluded.length !== rows.length)
    blockedReasons._selection = 'Select at least one food to continue.';
  return {
    canContinue:
      rows.length > 0 &&
      included.length > 0 &&
      unresolved.length === 0 &&
      excluded.length < rows.length,
    included,
    blockedReasons,
    excluded,
    unresolved,
  };
}

function numericEstimateValues(row: PhotoReviewRow): {
  foodName: string;
  calories: number;
  proteinGrams: number;
  carbohydrateGrams: number;
  fatGrams: number;
} | null {
  const draft = row.estimateDraft;
  if (draft === undefined) return null;
  const values = {
    foodName: draft.foodName.trim(),
    calories: Number(draft.calories.trim()),
    proteinGrams: Number(draft.proteinGrams.trim()),
    carbohydrateGrams: Number(draft.carbohydrateGrams.trim()),
    fatGrams: Number(draft.fatGrams.trim()),
  };
  return Object.values(values).every((value) =>
    typeof value === 'number' ? Number.isFinite(value) : value.length > 0,
  )
    ? values
    : null;
}

export function photoEstimateValidation(
  row: PhotoReviewRow,
): PhotoEstimateFieldErrors {
  const errors: PhotoEstimateFieldErrors = {};
  const draft = row.estimateDraft;
  if (draft === undefined) {
    return {
      foodName: 'Enter a food name.',
      calories: 'Enter calories.',
      proteinGrams: 'Enter protein.',
      carbohydrateGrams: 'Enter carbohydrates.',
      fatGrams: 'Enter fat.',
    };
  }
  if (draft.foodName.trim() === '') errors.foodName = 'Enter a food name.';
  else if (draft.foodName.trim().length > 120)
    errors.foodName = 'Food name must be 120 characters or fewer.';

  const numericFields: Array<{
    field: Exclude<PhotoEstimateField, 'foodName'>;
    label: string;
    max: number;
    positive: boolean;
  }> = [
    {
      field: 'calories',
      label: 'Calories',
      max: PHOTO_NUTRITION_ESTIMATE_MAX_CALORIES,
      positive: true,
    },
    {
      field: 'proteinGrams',
      label: 'Protein',
      max: PHOTO_NUTRITION_ESTIMATE_MAX_MACRO_GRAMS,
      positive: false,
    },
    {
      field: 'carbohydrateGrams',
      label: 'Carbohydrates',
      max: PHOTO_NUTRITION_ESTIMATE_MAX_MACRO_GRAMS,
      positive: false,
    },
    {
      field: 'fatGrams',
      label: 'Fat',
      max: PHOTO_NUTRITION_ESTIMATE_MAX_MACRO_GRAMS,
      positive: false,
    },
  ];
  for (const { field, label, max, positive } of numericFields) {
    const raw = draft[field].trim();
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value)) {
      errors[field] = `${label} must be a finite number.`;
    } else if (positive && value <= 0) {
      errors[field] = `${label} must be greater than 0.`;
    } else if (!positive && value < 0) {
      errors[field] = `${label} must be 0 or higher.`;
    } else if (value > max) {
      errors[field] = `${label} must be ${max} or lower.`;
    }
  }

  const values = numericEstimateValues(row);
  if (
    values !== null &&
    errors.calories === undefined &&
    errors.proteinGrams === undefined &&
    errors.carbohydrateGrams === undefined &&
    errors.fatGrams === undefined
  ) {
    const macroEnergy =
      values.proteinGrams * 4 +
      values.carbohydrateGrams * 4 +
      values.fatGrams * 9;
    const tolerance = Math.max(
      PHOTO_NUTRITION_ESTIMATE_ENERGY_TOLERANCE_KCAL,
      values.calories * PHOTO_NUTRITION_ESTIMATE_ENERGY_TOLERANCE_RATIO,
    );
    if (Math.abs(values.calories - macroEnergy) > tolerance) {
      errors.calories = 'Calories are inconsistent with the entered macros.';
    }
  }
  return errors;
}

export function updatePhotoEstimateDraft(
  row: PhotoReviewRow,
  field: PhotoEstimateField,
  value: string,
): PhotoReviewRow {
  if (row.estimateDraft === undefined) return row;
  return {
    ...row,
    estimateDraft: { ...row.estimateDraft, [field]: value },
  };
}

function estimateNutritionChanged(row: PhotoReviewRow): boolean {
  const estimate = row.recognizedItem.estimatedNutrition;
  const values = numericEstimateValues(row);
  return (
    estimate !== undefined &&
    values !== null &&
    (values.calories !== estimate.calories ||
      values.proteinGrams !== estimate.proteinGrams ||
      values.carbohydrateGrams !== estimate.carbohydrateGrams ||
      values.fatGrams !== estimate.fatGrams)
  );
}

function estimateNameChanged(row: PhotoReviewRow): boolean {
  return (
    row.estimateDraft !== undefined &&
    row.estimateDraft.foodName.trim() !== row.recognizedItem.recognizedName
  );
}

export function photoRowsMixedConfirmationRequest(input: {
  rows: PhotoReviewRow[];
  mealType: MealType;
  loggedAt: string;
  notes?: string | null;
}): PhotoAnalysisConfirmationInput {
  if (input.rows.length === 0) throw new Error('Photo review has no entries.');
  if (input.rows.length > PHOTO_ANALYSIS_MAX_ITEMS) {
    throw new Error('A photo can contain up to eight review rows.');
  }
  const rowRefs = new Set<string>();
  for (const row of input.rows) {
    if (rowRefs.has(row.id))
      throw new Error('Each photo row may appear only once.');
    rowRefs.add(row.id);
  }
  const disposition = photoRowsDisposition(input.rows);
  if (input.rows.every((row) => row.disposition === 'excluded')) {
    throw new Error('at least one photo row must be saved.');
  }
  if (!disposition.canContinue) {
    const firstReason = Object.values(disposition.blockedReasons)[0];
    throw new Error(
      `Photo review has an unresolved row: ${firstReason ?? 'review every row'}.`,
    );
  }

  const sharedNotes = input.notes?.trim();
  const entries = input.rows.map((row) => {
    if (row.disposition === 'excluded') {
      return { rowRef: row.id, disposition: 'excluded' as const };
    }
    if (row.disposition === 'trusted') {
      const candidate = selectedPhotoCandidate(row);
      const preview = photoRowServingPreview(row);
      if (
        !photoCandidateIsMixedCompatible(candidate) ||
        preview?.requestedServing === null ||
        preview?.requestedServing === undefined
      ) {
        throw new Error(
          `Photo row ${row.id} does not have a compatible trusted serving.`,
        );
      }
      return {
        rowRef: row.id,
        disposition: 'trusted' as const,
        candidateId: candidate.foodItem.id,
        serving: preview.requestedServing,
        ...(sharedNotes === undefined || sharedNotes === ''
          ? {}
          : { notes: sharedNotes }),
      };
    }
    if (row.disposition !== 'estimated') {
      throw new Error(`Photo row ${row.id} is unresolved.`);
    }
    const estimate = row.recognizedItem.estimatedNutrition;
    const values = numericEstimateValues(row);
    if (
      estimate === undefined ||
      row.estimateProofUnavailable === true ||
      estimate.estimateProof === undefined ||
      values === null ||
      Object.keys(photoEstimateValidation(row)).length > 0
    ) {
      throw new Error(`Photo row ${row.id} has invalid estimate values.`);
    }
    return {
      rowRef: row.id,
      disposition: 'estimated' as const,
      estimateProof: estimate.estimateProof,
      ...(estimateNameChanged(row)
        ? { confirmedFoodName: values.foodName }
        : {}),
      ...(estimateNutritionChanged(row)
        ? {
            userAdjustedNutrition: {
              calories: values.calories,
              proteinGrams: values.proteinGrams,
              carbohydrateGrams: values.carbohydrateGrams,
              fatGrams: values.fatGrams,
            },
          }
        : {}),
      ...(sharedNotes === undefined || sharedNotes === ''
        ? {}
        : { notes: sharedNotes }),
    };
  });
  const request = {
    mealType: input.mealType,
    loggedAt: input.loggedAt,
    entries,
  };
  const parsed = photoAnalysisConfirmationInputSchema.safeParse(request);
  if (!parsed.success) {
    throw new Error('Photo confirmation request failed shared validation.');
  }
  return parsed.data;
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
      'Every included photo row must have a valid serving before saving.',
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
        throw new Error('A trusted photo row is missing a valid serving.');
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
    const provider =
      candidate.externalFood.sourceProvider === 'usda_fdc'
        ? 'USDA'
        : candidate.externalFood.sourceProvider === 'open_food_facts'
          ? 'Open Food Facts'
          : 'External provider';
    return `${provider} · ${candidate.externalFood.servingBasisText}`;
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

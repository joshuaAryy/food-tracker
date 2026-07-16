import {
  PHOTO_ANALYSIS_MAX_ITEMS,
  photoRepresentationModeSchema,
  type PhotoProvisionalQuantity,
  type PhotoRepresentationAlternative,
  type PhotoRepresentationGroup,
  type PhotoRepresentationItem,
  type PhotoRepresentationKind,
  type PhotoRepresentationMode,
  type PhotoRecognizedItem,
} from '@food-tracker/shared';
import { AppError } from '../../lib/errors.js';
import {
  normalizeText,
  normalizeToken,
} from '../foodItems/candidate-ranking.js';
import type {
  ProviderPhotoRepresentation,
  ProviderPhotoSuggestion,
} from './photo-provider.js';
import { photoAnalysisDiagnosticDetails } from './photo-diagnostics.js';

const genericCoverageLabels = new Set(['food', 'meal', 'item', 'serving']);
const MIN_REGION_OVERLAP_RATIO = 0.25;

export interface AdaptedPhotoRepresentationItem {
  suggestion: ProviderPhotoSuggestion;
  itemId: string;
  groupId: string;
  representationKind: PhotoRepresentationKind;
  coverage: string[];
  excludedCoverage: string[];
  visiblePortionDescription: string | null;
  legacy: boolean;
}

export interface AdaptedPhotoRepresentations {
  active: AdaptedPhotoRepresentationItem[];
  groups: PhotoRepresentationGroup[];
}

type NormalizedProviderRepresentation = Omit<
  ProviderPhotoRepresentation,
  'visiblePortionDescription'
> & {
  visiblePortionDescription: string | null;
};

interface NormalizedRepresentationEntry {
  suggestion: ProviderPhotoSuggestion;
  itemIndex: number;
  representation: NormalizedProviderRepresentation;
  coverage: string[];
  excludedCoverage: string[];
}

interface RepresentationSelection {
  activeItems: NormalizedRepresentationEntry[];
  inactiveItems: NormalizedRepresentationEntry[];
  reason:
    | 'provider_decomposed'
    | 'provider_composite'
    | 'complete_high_confidence_components';
}

function logRepresentationDiagnostic(
  category: string,
  details: Record<string, unknown>,
): never {
  recordRepresentationDiagnostic(category, details);
  throw new AppError(
    503,
    'AI_UNAVAILABLE',
    'Photo analysis returned invalid representation data.',
  );
}

function recordRepresentationDiagnostic(
  category: string,
  details: Record<string, unknown>,
): void {
  console.warn(
    '[photo-analysis:representation]',
    photoAnalysisDiagnosticDetails({ category, ...details }),
  );
}

function normalizeCoverageLabel(label: string): string {
  return normalizeText(label)
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 0)
    .join(' ');
}

function normalizeCoverage(
  labels: string[],
  input: {
    groupIndex: number;
    itemIndex: number;
    field: string;
    allowEmpty?: boolean;
  },
): string[] {
  if (labels.length === 0) {
    if (input.allowEmpty === true) return [];
    return logRepresentationDiagnostic('invalid_coverage_reference', {
      ...input,
      reason: 'missing_coverage',
    });
  }
  const normalized = labels.map(normalizeCoverageLabel);
  if (normalized.some((label) => label.length === 0)) {
    return logRepresentationDiagnostic('invalid_coverage_reference', {
      ...input,
      reason: 'empty_label',
    });
  }
  if (
    normalized.some((label) =>
      label.split(' ').some((token) => genericCoverageLabels.has(token)),
    )
  ) {
    return logRepresentationDiagnostic('invalid_coverage_reference', {
      ...input,
      reason: 'generic_label',
    });
  }
  const unique = [...new Set(normalized)];
  if (unique.length !== normalized.length) {
    return logRepresentationDiagnostic('duplicate_active_coverage', {
      ...input,
      reason: 'duplicate_within_representation',
    });
  }
  return unique;
}

function representationQuantity(
  suggestion: ProviderPhotoSuggestion,
): PhotoProvisionalQuantity {
  return suggestion.quantity.quantityState === 'estimated'
    ? {
        state: 'estimated',
        amount: suggestion.quantity.quantityAmount,
        unit: suggestion.quantity.quantityUnit,
        countLabel: suggestion.quantity.quantityCountLabel,
        rawText: suggestion.quantity.quantityRawText,
        confidence: suggestion.quantity.quantityConfidence,
        source: 'vision_structured',
        ...(suggestion.quantity.massEstimateGrams === undefined
          ? {}
          : { massEstimateGrams: suggestion.quantity.massEstimateGrams }),
        ...(suggestion.quantity.massEstimateConfidence === undefined
          ? {}
          : {
              massEstimateConfidence:
                suggestion.quantity.massEstimateConfidence,
            }),
      }
    : {
        state: 'no_responsible_estimate',
        source: 'unresolved_visible_portion',
      };
}

function hasExplicitRepresentation(
  representation: ProviderPhotoRepresentation,
): boolean {
  return (
    representation.groupKey !== null ||
    representation.representationMode !== null ||
    representation.representationKind !== null ||
    representation.active === false ||
    representation.coverage.length > 0 ||
    representation.excludedCoverage.length > 0 ||
    representation.representationConfidence !== null ||
    representation.visiblePortionDescription !== null
  );
}

function normalizeVisiblePortionDescription(
  value: unknown,
  itemIndex: number,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    recordRepresentationDiagnostic('provider_optional_metadata_discarded', {
      itemIndex,
      field: 'visiblePortionDescription',
      reason: 'non_string',
    });
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 160) {
    recordRepresentationDiagnostic('provider_optional_metadata_discarded', {
      itemIndex,
      field: 'visiblePortionDescription',
      reason: 'invalid_length',
    });
    return null;
  }
  return trimmed;
}

function normalizeProviderRepresentation(
  suggestion: ProviderPhotoSuggestion,
  itemIndex: number,
): NormalizedProviderRepresentation {
  const representation = suggestion.representation;
  if (!hasExplicitRepresentation(representation)) {
    return {
      groupKey: `legacy-${itemIndex + 1}`,
      representationMode: 'composite',
      representationKind: 'composite',
      active: true,
      coverage: [suggestion.name],
      excludedCoverage: [],
      representationConfidence: suggestion.identityConfidence,
      visiblePortionDescription: null,
    };
  }

  if (
    representation.groupKey === null ||
    representation.representationMode === null ||
    representation.representationKind === null
  ) {
    return logRepresentationDiagnostic('invalid_representation_group', {
      itemIndex,
      reason: 'missing_group_or_representation_fields',
    });
  }

  if (
    (representation.representationMode === 'decomposed' &&
      representation.representationKind !== 'component') ||
    (representation.representationMode === 'composite' &&
      representation.representationKind !== 'composite')
  ) {
    return logRepresentationDiagnostic('invalid_representation_group', {
      itemIndex,
      reason: 'representation_kind_mismatch',
    });
  }

  if (
    !photoRepresentationModeSchema.safeParse(representation.representationMode)
      .success
  ) {
    return logRepresentationDiagnostic('invalid_representation_group', {
      itemIndex,
      reason: 'unsupported_representation_mode',
    });
  }

  const excludedCoverage =
    representation.representationKind === 'component' &&
    representation.excludedCoverage.length > 0
      ? (() => {
          recordRepresentationDiagnostic(
            'provider_optional_metadata_discarded',
            {
              itemIndex,
              field: 'excludedCoverage',
              exclusionReferenceCount: representation.excludedCoverage.length,
              reason: 'component_cannot_exclude_coverage',
            },
          );
          return [];
        })()
      : representation.excludedCoverage;

  return {
    ...representation,
    excludedCoverage,
    visiblePortionDescription: normalizeVisiblePortionDescription(
      representation.visiblePortionDescription,
      itemIndex,
    ),
  };
}

function validateExclusions(input: {
  excludedCoverage: string[];
  coverage: string[];
  activeCoverage: Set<string>;
  groupIndex: number;
  itemIndex: number;
  representationMode: PhotoRepresentationMode;
}): void {
  if (input.excludedCoverage.length === 0) return;
  if (input.representationMode !== 'composite') {
    logRepresentationDiagnostic('invalid_exclusion_reference', {
      groupIndex: input.groupIndex,
      itemIndex: input.itemIndex,
      reason: 'only_composites_may_exclude_coverage',
    });
  }
  const coverage = new Set(input.coverage);
  if (input.excludedCoverage.some((label) => !coverage.has(label))) {
    logRepresentationDiagnostic('invalid_exclusion_reference', {
      groupIndex: input.groupIndex,
      itemIndex: input.itemIndex,
      reason: 'unknown_coverage',
    });
  }
  if (
    input.excludedCoverage.some((label) => !input.activeCoverage.has(label))
  ) {
    logRepresentationDiagnostic('invalid_exclusion_reference', {
      groupIndex: input.groupIndex,
      itemIndex: input.itemIndex,
      reason: 'coverage_not_in_active_context',
    });
  }
  if (input.excludedCoverage.length >= input.coverage.length) {
    logRepresentationDiagnostic('invalid_exclusion_reference', {
      groupIndex: input.groupIndex,
      itemIndex: input.itemIndex,
      reason: 'excludes_all_coverage',
    });
  }
}

function sameCoverage(first: string[], second: string[]): boolean {
  const firstSet = new Set(first);
  const secondSet = new Set(second);
  return (
    firstSet.size === first.length &&
    secondSet.size === second.length &&
    firstSet.size === secondSet.size &&
    [...firstSet].every((label) => secondSet.has(label))
  );
}

function selectRepresentation(input: {
  groupItems: NormalizedRepresentationEntry[];
  invalidAlternativeIndexes: Set<number>;
}): RepresentationSelection {
  const providerActiveItems = input.groupItems.filter(
    (item) => item.representation.active,
  );
  const availableInactiveItems = input.groupItems.filter(
    (item) =>
      !item.representation.active &&
      !input.invalidAlternativeIndexes.has(item.itemIndex),
  );
  const providerMode =
    providerActiveItems[0]?.representation.representationMode;
  if (
    providerMode !== 'composite' ||
    providerActiveItems.length !== 1 ||
    availableInactiveItems.length < 2 ||
    availableInactiveItems.some(
      (item) =>
        item.representation.representationMode !== 'decomposed' ||
        item.representation.representationKind !== 'component' ||
        item.representation.representationConfidence !== 'high',
    )
  ) {
    return {
      activeItems: providerActiveItems,
      inactiveItems: availableInactiveItems,
      reason:
        providerMode === 'decomposed'
          ? 'provider_decomposed'
          : 'provider_composite',
    };
  }

  const composite = providerActiveItems[0]!;
  const compositeCoverage = composite.coverage.filter(
    (label) => !composite.excludedCoverage.includes(label),
  );
  const componentCoverage = availableInactiveItems.flatMap(
    (item) => item.coverage,
  );
  if (!sameCoverage(compositeCoverage, componentCoverage)) {
    return {
      activeItems: providerActiveItems,
      inactiveItems: availableInactiveItems,
      reason: 'provider_composite',
    };
  }

  return {
    activeItems: availableInactiveItems,
    inactiveItems: providerActiveItems,
    reason: 'complete_high_confidence_components',
  };
}

function regionOverlap(
  first: ProviderPhotoSuggestion['region'],
  second: ProviderPhotoSuggestion['region'],
): boolean {
  if (first === null || second === null) return false;
  const firstArea = first.width * first.height;
  const secondArea = second.width * second.height;
  const intersectionWidth = Math.max(
    0,
    Math.min(first.x + first.width, second.x + second.width) -
      Math.max(first.x, second.x),
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(first.y + first.height, second.y + second.height) -
      Math.max(first.y, second.y),
  );
  const intersection = intersectionWidth * intersectionHeight;
  // Compare intersection against the smaller region. This conservatively
  // treats containment as overlap while ignoring edge-touching and tiny
  // incidental intersections.
  return (
    intersection > 0 &&
    intersection / Math.min(firstArea, secondArea) >= MIN_REGION_OVERLAP_RATIO
  );
}

function validateCrossGroupOverlap(
  active: AdaptedPhotoRepresentationItem[],
): Set<string> {
  const uncertainGroupIds = new Set<string>();
  for (let firstIndex = 0; firstIndex < active.length; firstIndex += 1) {
    const first = active[firstIndex]!;
    const firstCoverage = new Set(first.coverage);
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < active.length;
      secondIndex += 1
    ) {
      const second = active[secondIndex]!;
      if (first.groupId === second.groupId) continue;
      if (first.legacy && second.legacy) continue;
      const sharedCoverage = second.coverage.filter((label) =>
        firstCoverage.has(label),
      );
      if (sharedCoverage.length === 0) continue;

      const explicitlySeparated = sharedCoverage.every(
        (label) =>
          (first.representationKind === 'composite' &&
            first.excludedCoverage.includes(label)) ||
          (second.representationKind === 'composite' &&
            second.excludedCoverage.includes(label)),
      );
      if (explicitlySeparated) continue;

      const compositeComponentDuplicate =
        first.representationKind !== second.representationKind;
      if (compositeComponentDuplicate) {
        logRepresentationDiagnostic('overlapping_active_representations', {
          firstItemIndex: firstIndex,
          secondItemIndex: secondIndex,
          reason: 'cross_group_composite_component_duplicate',
        });
      }

      if (
        first.suggestion.region !== null &&
        second.suggestion.region !== null &&
        !regionOverlap(first.suggestion.region, second.suggestion.region)
      ) {
        continue;
      }

      if (
        first.suggestion.region !== null &&
        second.suggestion.region !== null
      ) {
        logRepresentationDiagnostic('overlapping_active_representations', {
          firstItemIndex: firstIndex,
          secondItemIndex: secondIndex,
          reason: 'cross_group_region_overlap',
        });
      }

      uncertainGroupIds.add(first.groupId);
      uncertainGroupIds.add(second.groupId);
      recordRepresentationDiagnostic('potential_cross_group_overlap', {
        firstItemIndex: firstIndex,
        secondItemIndex: secondIndex,
        reason: 'matching_coverage_without_spatial_evidence',
      });
    }
  }
  return uncertainGroupIds;
}

function inactiveAlternativeItem(input: {
  adapted: AdaptedPhotoRepresentationItem;
  id: string;
}): PhotoRepresentationItem {
  const { adapted } = input;
  return {
    id: input.id,
    representationGroupId: adapted.groupId,
    recognizedName: adapted.suggestion.name,
    preparationForm: adapted.suggestion.preparationForm,
    quantity: representationQuantity(adapted.suggestion),
    identityConfidence: adapted.suggestion.identityConfidence,
    region: adapted.suggestion.region,
    representationKind: adapted.representationKind,
    active: false,
    coverage: adapted.coverage,
    excludedCoverage: adapted.excludedCoverage,
    visiblePortionDescription: adapted.visiblePortionDescription,
  };
}

export function adaptPhotoRepresentations(
  suggestions: ProviderPhotoSuggestion[],
): AdaptedPhotoRepresentations {
  const normalized: NormalizedRepresentationEntry[] = suggestions.flatMap(
    (suggestion, itemIndex) => {
      try {
        const representation = normalizeProviderRepresentation(
          suggestion,
          itemIndex,
        );
        return [
          {
            suggestion,
            itemIndex,
            representation,
            coverage: representation.coverage,
            excludedCoverage: representation.excludedCoverage,
          },
        ];
      } catch (error) {
        if (
          suggestion.representation.active === false &&
          error instanceof AppError
        ) {
          recordRepresentationDiagnostic(
            'provider_optional_alternative_discarded',
            { itemIndex, reason: 'invalid_alternative_metadata' },
          );
          return [];
        }
        throw error;
      }
    },
  );

  const groups = new Map<string, typeof normalized>();
  for (const item of normalized) {
    const groupKey = item.representation.groupKey!;
    const group = groups.get(groupKey) ?? [];
    group.push(item);
    groups.set(groupKey, group);
  }

  const active: AdaptedPhotoRepresentationItem[] = [];
  const outputGroups: PhotoRepresentationGroup[] = [];
  const discardedGroups: Array<{
    coverage: Set<string>;
    regions: ProviderPhotoSuggestion['region'][];
  }> = [];
  let activeItemNumber = 0;
  let groupNumber = 0;

  for (const groupItems of groups.values()) {
    groupNumber += 1;
    const groupIndex = groupNumber - 1;
    try {
      const invalidAlternativeIndexes = new Set<number>();
      for (const item of groupItems) {
        try {
          const coverage =
            item.representation.coverage.length > 0
              ? item.representation.coverage
              : [item.suggestion.name];
          item.coverage = normalizeCoverage(coverage, {
            groupIndex,
            itemIndex: item.itemIndex,
            field: 'coverage',
          });
          item.excludedCoverage = normalizeCoverage(
            item.representation.excludedCoverage,
            {
              groupIndex,
              itemIndex: item.itemIndex,
              field: 'excludedCoverage',
              allowEmpty: true,
            },
          );
        } catch (error) {
          if (!item.representation.active && error instanceof AppError) {
            invalidAlternativeIndexes.add(item.itemIndex);
            item.coverage = [];
            item.excludedCoverage = [];
            recordRepresentationDiagnostic(
              'provider_optional_alternative_discarded',
              {
                groupIndex,
                itemIndex: item.itemIndex,
                reason: 'invalid_alternative_coverage',
              },
            );
            continue;
          }
          throw error;
        }
      }

      const selection = selectRepresentation({
        groupItems,
        invalidAlternativeIndexes,
      });
      const activeItems = selection.activeItems;
      if (activeItems.length === 0) {
        logRepresentationDiagnostic('invalid_representation_group', {
          groupIndex,
          reason: 'missing_active_representation',
        });
      }
      const activeModes = new Set(
        activeItems.map((item) => item.representation.representationMode),
      );
      if (activeModes.size !== 1) {
        logRepresentationDiagnostic('overlapping_active_representations', {
          groupIndex,
          reason: 'multiple_active_modes',
        });
      }
      const activeRepresentation = [...activeModes][0];
      if (activeRepresentation === undefined) {
        logRepresentationDiagnostic('invalid_representation_group', {
          groupIndex,
          reason: 'missing_active_mode',
        });
      }
      if (activeRepresentation === 'decomposed') {
        if (
          activeItems.length < 2 ||
          activeItems.some(
            (item) => item.representation.representationKind !== 'component',
          )
        ) {
          logRepresentationDiagnostic('invalid_representation_group', {
            groupIndex,
            reason: 'invalid_decomposed_active_items',
          });
        }
      } else if (
        activeItems.length !== 1 ||
        activeItems[0]?.representation.representationKind !== 'composite'
      ) {
        logRepresentationDiagnostic('invalid_representation_group', {
          groupIndex,
          reason: 'invalid_composite_active_items',
        });
      }

      const activeCoverage = new Set<string>();
      for (const item of activeItems) {
        for (const label of item.coverage) {
          if (activeCoverage.has(label)) {
            logRepresentationDiagnostic('duplicate_active_coverage', {
              groupIndex,
              itemIndex: item.itemIndex,
              reason: 'duplicate_active_coverage',
            });
          }
          activeCoverage.add(label);
        }
      }
      for (const item of activeItems) {
        validateExclusions({
          excludedCoverage: item.excludedCoverage,
          coverage: item.coverage,
          activeCoverage,
          groupIndex,
          itemIndex: item.itemIndex,
          representationMode: item.representation.representationMode!,
        });
      }

      let inactiveItems = selection.inactiveItems;
      let inactiveMode: PhotoRepresentationMode | null | undefined;
      let alternativeValid = true;
      try {
        for (const item of inactiveItems) {
          validateExclusions({
            excludedCoverage: item.excludedCoverage,
            coverage: item.coverage,
            activeCoverage,
            groupIndex,
            itemIndex: item.itemIndex,
            representationMode: item.representation.representationMode!,
          });
        }
        const inactiveCoverage = new Set<string>();
        for (const item of inactiveItems) {
          for (const label of item.coverage) {
            if (inactiveCoverage.has(label)) {
              logRepresentationDiagnostic('duplicate_active_coverage', {
                groupIndex,
                itemIndex: item.itemIndex,
                reason: 'duplicate_alternative_coverage',
              });
            }
            inactiveCoverage.add(label);
          }
        }
        const inactiveModes = new Set(
          inactiveItems.map((item) => item.representation.representationMode),
        );
        if (inactiveModes.has(activeRepresentation) || inactiveModes.size > 1) {
          logRepresentationDiagnostic('overlapping_active_representations', {
            groupIndex,
            reason: 'invalid_inactive_alternative_mode',
          });
        }
        inactiveMode = [...inactiveModes][0];
        if (inactiveMode === 'decomposed') {
          if (
            inactiveItems.length < 2 ||
            inactiveItems.some(
              (item) => item.representation.representationKind !== 'component',
            )
          ) {
            logRepresentationDiagnostic('invalid_representation_group', {
              groupIndex,
              reason: 'invalid_decomposed_alternative',
            });
          }
        } else if (inactiveMode === 'composite') {
          if (
            inactiveItems.length !== 1 ||
            inactiveItems[0]?.representation.representationKind !== 'composite'
          ) {
            logRepresentationDiagnostic('invalid_representation_group', {
              groupIndex,
              reason: 'invalid_composite_alternative',
            });
          }
        }
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        alternativeValid = false;
      }
      if (!alternativeValid) {
        recordRepresentationDiagnostic(
          'provider_optional_alternative_discarded',
          { groupIndex, reason: 'invalid_optional_alternative' },
        );
        inactiveItems = [];
        inactiveMode = undefined;
      }

      const groupId = `photo-group-${groupNumber}`;
      const activeItemIds: string[] = [];
      for (const item of activeItems) {
        activeItemNumber += 1;
        const itemId = `photo-item-${activeItemNumber}`;
        activeItemIds.push(itemId);
        active.push({
          suggestion: item.suggestion,
          itemId,
          groupId,
          representationKind: item.representation.representationKind!,
          coverage: item.coverage,
          excludedCoverage: item.excludedCoverage,
          visiblePortionDescription:
            item.representation.visiblePortionDescription,
          legacy: !hasExplicitRepresentation(item.suggestion.representation),
        });
      }

      const alternatives: PhotoRepresentationAlternative[] = [];
      if (inactiveItems.length > 0) {
        const alternativeId = `photo-alt-${groupNumber}-1`;
        const alternativeItems = inactiveItems.map((item, index) =>
          inactiveAlternativeItem({
            adapted: {
              suggestion: item.suggestion,
              itemId: `${alternativeId}-${index + 1}`,
              groupId,
              representationKind: item.representation.representationKind!,
              coverage: item.coverage,
              excludedCoverage: item.excludedCoverage,
              visiblePortionDescription:
                item.representation.visiblePortionDescription,
              legacy: !hasExplicitRepresentation(
                item.suggestion.representation,
              ),
            },
            id: `${alternativeId}-${index + 1}`,
          }),
        );
        alternatives.push({
          id: alternativeId,
          representation: inactiveMode!,
          active: false,
          itemIds: alternativeItems.map((item) => item.id),
          items: alternativeItems,
        });
      }

      outputGroups.push({
        id: groupId,
        activeRepresentation: activeRepresentation!,
        activeItemIds,
        representationConfidence:
          activeItems[0]?.representation.representationConfidence ??
          activeItems[0]?.suggestion.identityConfidence ??
          'low',
        region: null,
        overlapStatus: 'non_overlapping',
        reviewReason: null,
        alternatives,
      });
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      const groupActiveItems = groupItems.filter(
        (item) => item.representation.active,
      );
      recordRepresentationDiagnostic(
        'provider_representation_group_discarded',
        {
          groupIndex,
          reason: 'invalid_active_representation',
          activeRepresentationModes: [
            ...new Set(
              groupActiveItems.map(
                (item) => item.representation.representationMode,
              ),
            ),
          ],
          activeItemCount: groupActiveItems.length,
          activeComponentCount: groupActiveItems.filter(
            (item) => item.representation.representationKind === 'component',
          ).length,
          compositeCount: groupItems.filter(
            (item) => item.representation.representationKind === 'composite',
          ).length,
          alternativeCount: groupItems.filter(
            (item) => !item.representation.active,
          ).length,
          coverageCount: groupItems.reduce(
            (count, item) => count + item.coverage.length,
            0,
          ),
          exclusionCount: groupItems.reduce(
            (count, item) => count + item.excludedCoverage.length,
            0,
          ),
          localReferenceCount: groupItems.length,
          activeRowCount: active.length,
        },
      );
      discardedGroups.push({
        coverage: new Set(groupItems.flatMap((item) => item.coverage)),
        regions: groupItems.map((item) => item.suggestion.region),
      });
    }
  }

  for (const discarded of discardedGroups) {
    for (const item of active) {
      const sharesCoverage = item.coverage.some((label) =>
        discarded.coverage.has(label),
      );
      if (!sharesCoverage) continue;
      const provenSeparate = discarded.regions.every(
        (region) =>
          region !== null &&
          item.suggestion.region !== null &&
          !regionOverlap(region, item.suggestion.region),
      );
      if (!provenSeparate) {
        logRepresentationDiagnostic('invalid_representation_group', {
          reason: 'discarded_group_overlaps_valid_group',
        });
      }
    }
  }

  if (outputGroups.length === 0) {
    logRepresentationDiagnostic('invalid_representation_group', {
      reason: 'all_groups_invalid',
    });
  }

  if (active.length > PHOTO_ANALYSIS_MAX_ITEMS) {
    logRepresentationDiagnostic('too_many_active_rows', {
      activeCount: active.length,
    });
  }
  const uncertainGroupIds = validateCrossGroupOverlap(active);
  for (const group of outputGroups) {
    if (uncertainGroupIds.has(group.id)) {
      group.overlapStatus = 'uncertain';
    }
  }
  return { active, groups: outputGroups };
}

export function representationMetadataForRow(
  item: AdaptedPhotoRepresentationItem,
): Pick<
  PhotoRecognizedItem,
  | 'representationGroupId'
  | 'representationKind'
  | 'active'
  | 'coverage'
  | 'excludedCoverage'
  | 'visiblePortionDescription'
> {
  return {
    representationGroupId: item.groupId,
    representationKind: item.representationKind,
    active: true,
    coverage: item.coverage,
    excludedCoverage: item.excludedCoverage,
    visiblePortionDescription: item.visiblePortionDescription,
  };
}

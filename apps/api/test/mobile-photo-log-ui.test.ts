import { describe, expect, it, vi } from 'vitest';
import type {
  AiFoodParseCandidate,
  FoodItem,
  PhotoAnalysisResult,
} from '@food-tracker/shared';
import {
  addPhotoRow,
  changePhotoServingChoice,
  confirmPhotoRow,
  ensurePhotoLibraryPermission,
  photoExternalResolutionState,
  photoCandidateId,
  photoNutritionProjection,
  photoRowDisplayName,
  photoRowLabelSource,
  photoRowReason,
  photoRowServingChoices,
  photoRowStatusLabel,
  photoRowsDisposition,
  photoRowsFromAnalysis,
  photoRowsMixedConfirmationRequest,
  materializePhotoCandidate,
  photoEstimateValidation,
  photoRowsSaveRequest,
  replacePhotoRowCandidate,
  restorePhotoRow,
  setPhotoRowIncluded,
  setPhotoRowDisposition,
  updatePhotoEstimateDraft,
} from '../../mobile/src/lib/photo-log-ui.js';
import { safePhotoLogBack } from '../../mobile/src/lib/photo-log-navigation.js';
import {
  cleanupPhotoFiles,
  readNormalizedPhotoBytes,
  normalizePhotoImageWithOperations,
  normalizedPhotoDimensions,
  orientationActions,
  photoAnalysisRequestInit,
  PhotoImageError,
} from '../../mobile/src/lib/photo-image-core.js';
import { parseApiResponse } from '../../mobile/src/lib/api-response.js';
import { photoAnalysisResultSchema } from '@food-tracker/shared';

const food = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'Chicken breast',
  brandName: null,
  sourceType: 'app_owned',
  foodType: 'generic',
  sourceProvider: 'usda_fdc',
  sourceId: '123',
  sourceUpdatedAt: null,
  isSaved: true,
  servingQuantity: 100,
  servingUnit: 'g',
  servingWeightGrams: 100,
  servingOptions: null,
  calories: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  fiber: null,
  sugar: null,
  sodium: 74,
  additionalNutrients: null,
  nutrients: { potassium: { amount: 256, unit: 'mg' } },
  barcodes: [],
  createdAt: '',
  updatedAt: '',
} satisfies FoodItem;

const candidate = {
  candidateType: 'food_item' as const,
  foodItem: food,
  externalFood: null,
  rank: 1,
  matchReason: 'saved' as const,
  confidence: 'high' as const,
  defaultServingMultiplier: 1,
};

const result: PhotoAnalysisResult = {
  status: 'recognized',
  items: [
    {
      id: 'photo-item-1',
      recognizedName: 'Chicken',
      preparationForm: 'grilled',
      identityConfidence: 'high',
      portionConfidence: 'medium',
      region: null,
      provisionalPortion: {
        rawQuantityText: '150',
        rawServingText: '150 g',
        confidence: 'medium',
        parsed: {
          status: 'parsed',
          quantity: 150,
          unit: 'g',
          rawQuantityText: '150',
          rawServingText: '150 g',
        },
        quantity: {
          state: 'estimated',
          amount: 150,
          unit: 'gram',
          countLabel: null,
          rawText: '150 g',
          confidence: 'medium',
        },
        servingResolution: 'supported',
      },
      reviewStatus: 'matched',
      selectedCandidateId: food.id,
      loggable: true,
      candidates: [candidate],
      unresolvedReason: null,
      representationGroupId: 'photo-group-1',
      representationKind: 'composite',
      active: true,
      coverage: ['chicken'],
      excludedCoverage: [],
      visiblePortionDescription: null,
    },
  ],
  representationGroups: [],
};

describe('mobile photo image helpers', () => {
  it('uses the full trusted candidate name and exposes its trust source', () => {
    const longName = 'Pasta with tomato sauce and grated parmesan cheese';
    const baseItem = result.items[0]!;
    const row = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...baseItem,
          id: 'photo-item-1',
          recognizedName: 'pasta with tomato sauce',
          candidates: [
            {
              ...candidate,
              foodItem: { ...food, name: longName },
            },
          ],
        },
      ],
    })[0]!;

    expect(photoRowDisplayName(row)).toBe(longName);
    expect(photoRowLabelSource(row)).toBe('trusted_food_item');
    expect(photoRowStatusLabel(row)).toBe('Trusted match');
  });

  it('keeps USDA candidates visibly unresolved when nutrition detail is unavailable', () => {
    const baseItem = result.items[0]!;
    const externalCandidate = {
      candidateType: 'external_food' as const,
      foodItem: null,
      externalFood: {
        sourceProvider: 'usda_fdc',
        sourceId: '325036',
        name: 'Pasta with tomato sauce',
        brandName: null,
        foodType: 'generic' as const,
        servingBasisText: 'USDA details unavailable',
        servingQuantity: null,
        servingUnit: null,
        servingWeightGrams: null,
        servingOptions: null,
        defaultWholeItemServing: null,
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
        sugar: null,
        sodium: null,
        nutrients: {},
      },
      rank: 1,
      matchReason: 'usda_fdc' as const,
      confidence: 'low' as const,
      defaultServingMultiplier: 1,
    } satisfies AiFoodParseCandidate;
    const row = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...baseItem,
          id: 'photo-item-1',
          selectedCandidateId: null,
          candidates: [externalCandidate],
        },
      ],
    })[0]!;

    expect(photoRowLabelSource({ ...row, selectedCandidateId: null })).toBe(
      'unresolved_recognition',
    );
    const withCandidate = {
      ...row,
      selectedCandidateId: photoCandidateId(externalCandidate),
    };
    expect(photoRowLabelSource(withCandidate)).toBe('external_candidate');
    expect(photoRowStatusLabel(withCandidate)).toBe(
      'External match · temporarily unavailable',
    );
    expect(photoRowReason(withCandidate)).toContain(
      'External food details were unavailable',
    );
  });

  it('reads normalized JPEG bytes from the supported file boundary', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const file = {
      info: vi.fn(() => ({
        exists: true,
        isDirectory: false,
        size: bytes.length,
      })),
      bytes: vi.fn().mockResolvedValue(bytes),
    };

    await expect(
      readNormalizedPhotoBytes({
        uri: 'file://normalized.jpg',
        mimeType: 'image/jpeg',
        byteSize: bytes.length,
        signal: new AbortController().signal,
        openFile: () => file,
      }),
    ).resolves.toMatchObject({ byteSize: bytes.length });
    expect(file.info).toHaveBeenCalledTimes(1);
    expect(file.bytes).toHaveBeenCalledTimes(1);
  });

  it('rejects an unreadable normalized file before any request can be sent', async () => {
    await expect(
      readNormalizedPhotoBytes({
        uri: 'file://missing.jpg',
        mimeType: 'image/jpeg',
        byteSize: 5,
        signal: new AbortController().signal,
        openFile: () => ({
          info: () => ({ exists: false, isDirectory: false }),
          bytes: vi.fn(),
        }),
      }),
    ).rejects.toMatchObject({ code: 'PHOTO_FILE_UNAVAILABLE' });
  });

  it('rejects empty, oversized, changed, and non-JPEG normalized files', async () => {
    const cases = [
      {
        code: 'PHOTO_EMPTY',
        size: 0,
        bytes: new Uint8Array(),
      },
      {
        code: 'PHOTO_TOO_LARGE',
        size: 5 * 1024 * 1024 + 1,
        bytes: new Uint8Array([0xff, 0xd8, 0xff]),
      },
      {
        code: 'PHOTO_FILE_CHANGED',
        size: 4,
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]),
      },
      {
        code: 'PHOTO_INVALID_JPEG',
        size: 4,
        bytes: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
      },
    ] as const;

    for (const testCase of cases) {
      await expect(
        readNormalizedPhotoBytes({
          uri: 'file://normalized.jpg',
          mimeType: 'image/jpeg',
          byteSize: testCase.size,
          signal: new AbortController().signal,
          openFile: () => ({
            info: () => ({
              exists: true,
              isDirectory: false,
              size: testCase.size,
            }),
            bytes: vi.fn().mockResolvedValue(testCase.bytes),
          }),
        }),
      ).rejects.toMatchObject({ code: testCase.code });
    }
  });

  it('stops before opening a file when analysis is already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const openFile = vi.fn();

    await expect(
      readNormalizedPhotoBytes({
        uri: 'file://normalized.jpg',
        mimeType: 'image/jpeg',
        byteSize: 5,
        signal: controller.signal,
        openFile,
      }),
    ).rejects.toMatchObject({ code: 'PHOTO_CANCELLED' });
    expect(openFile).not.toHaveBeenCalled();
  });

  it('constructs a raw JPEG request without JSON or multipart wrapping', () => {
    const signal = new AbortController().signal;
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]).buffer;
    const request = photoAnalysisRequestInit({ bytes, signal });

    expect(request.method).toBe('POST');
    expect(request.headers['Content-Type']).toBe('image/jpeg');
    expect(request.body).toBe(bytes);
    expect(request.body).toBeInstanceOf(ArrayBuffer);
    expect(request.signal).toBe(signal);
  });

  it('requests read-only library access when permission is undetermined', async () => {
    const get = vi.fn().mockResolvedValue({
      granted: false,
      canAskAgain: true,
      accessPrivileges: 'none',
    });
    const request = vi.fn().mockResolvedValue({
      granted: true,
      canAskAgain: true,
      accessPrivileges: 'all',
    });

    await expect(
      ensurePhotoLibraryPermission({ get, request }),
    ).resolves.toMatchObject({
      status: 'granted',
      access: 'all',
    });
    expect(get).toHaveBeenCalledWith(false);
    expect(request).toHaveBeenCalledWith(false);
  });

  it.each(['all', 'limited'] as const)(
    'accepts existing %s library access without requesting write permission',
    async (accessPrivileges) => {
      const get = vi.fn().mockResolvedValue({
        granted: accessPrivileges === 'all',
        canAskAgain: false,
        accessPrivileges,
      });
      const request = vi.fn();

      await expect(
        ensurePhotoLibraryPermission({ get, request }),
      ).resolves.toMatchObject({
        status: 'granted',
        access: accessPrivileges,
      });
      expect(request).not.toHaveBeenCalled();
    },
  );

  it('returns a retryable denial when the user can ask again', async () => {
    const get = vi.fn().mockResolvedValue({
      granted: false,
      canAskAgain: true,
      accessPrivileges: 'none',
    });
    const request = vi.fn().mockResolvedValue({
      granted: false,
      canAskAgain: true,
      accessPrivileges: 'none',
    });

    await expect(
      ensurePhotoLibraryPermission({ get, request }),
    ).resolves.toMatchObject({
      status: 'denied',
      canAskAgain: true,
    });
  });

  it('returns a settings denial when access cannot be requested again', async () => {
    const get = vi.fn().mockResolvedValue({
      granted: false,
      canAskAgain: false,
      accessPrivileges: 'none',
    });
    const request = vi.fn();

    await expect(
      ensurePhotoLibraryPermission({ get, request }),
    ).resolves.toMatchObject({
      status: 'denied',
      canAskAgain: false,
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('propagates permission errors to the source action error boundary', async () => {
    const get = vi
      .fn()
      .mockRejectedValue(new Error('native permission failure'));
    const request = vi.fn();

    await expect(
      ensurePhotoLibraryPermission({ get, request }),
    ).rejects.toThrow('native permission failure');
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    [4032, 3024, { width: 2048, height: 1536 }],
    [3024, 4032, { width: 1536, height: 2048 }],
    [1200, 800, { width: 1200, height: 800 }],
    [2048, 2048, { width: 2048, height: 2048 }],
  ] as const)(
    'normalizes deterministic dimensions for %sx%s',
    (width, height, expected) => {
      expect(normalizedPhotoDimensions(width, height)).toEqual(expected);
    },
  );

  it('rejects invalid dimensions and exposes orientation actions', () => {
    expect(() => normalizedPhotoDimensions(0, 100)).toThrow(PhotoImageError);
    expect(orientationActions(6)).toEqual([{ rotate: 90 }]);
    expect(orientationActions(2)).toEqual([{ flip: 'horizontal' }]);
  });

  it('re-encodes to JPEG quality .75 and rejects an oversized processed file', async () => {
    const manipulate = vi.fn().mockResolvedValue({
      uri: 'cache://normalized.jpg',
      width: 2048,
      height: 1536,
    });
    const getInfo = vi.fn().mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 5 * 1024 * 1024 + 1,
    });
    const cleanup = vi.fn().mockResolvedValue(undefined);
    await expect(
      normalizePhotoImageWithOperations({
        uri: 'ph://library.heic',
        width: 4032,
        height: 3024,
        manipulate,
        getInfo,
        cleanup,
      }),
    ).rejects.toMatchObject({ code: 'PHOTO_TOO_LARGE' });
    expect(manipulate).toHaveBeenCalledWith(
      'ph://library.heic',
      [{ resize: { width: 2048, height: 1536 } }],
      expect.objectContaining({ compress: 0.75, format: expect.anything() }),
    );
    expect(cleanup).toHaveBeenCalledWith('cache://normalized.jpg');
  });

  it('accepts the exact 5 MiB processed-image boundary', async () => {
    const result = await normalizePhotoImageWithOperations({
      uri: 'file://source.jpg',
      width: 1200,
      height: 800,
      manipulate: vi.fn().mockResolvedValue({
        uri: 'cache://normalized.jpg',
        width: 1200,
        height: 800,
      }),
      getInfo: vi.fn().mockResolvedValue({
        exists: true,
        isDirectory: false,
        size: 5 * 1024 * 1024,
      }),
      cleanup: vi.fn(),
    });
    expect(result).toMatchObject({
      mimeType: 'image/jpeg',
      byteSize: 5 * 1024 * 1024,
      width: 1200,
      height: 800,
    });
  });

  it('never falls back to the original when normalization fails', async () => {
    const manipulate = vi.fn().mockRejectedValue(new Error('native failure'));
    await expect(
      normalizePhotoImageWithOperations({
        uri: 'file://original.heic',
        width: 1000,
        height: 800,
        manipulate,
        getInfo: vi.fn(),
        cleanup: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: 'NORMALIZATION_FAILED' });
    expect(manipulate).toHaveBeenCalledTimes(1);
  });

  it('never deletes user-owned library originals and makes cleanup idempotent', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    await cleanupPhotoFiles(
      [
        { uri: 'ph://library.jpg', ownership: 'user_library' },
        { uri: 'cache://capture.jpg', ownership: 'app_capture' },
        { uri: 'cache://normalized.jpg', ownership: 'app_normalized' },
        { uri: 'cache://normalized.jpg', ownership: 'app_normalized' },
      ],
      { delete: remove },
    );
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).not.toHaveBeenCalledWith('ph://library.jpg');
  });
});

describe('mobile photo review state and save boundary', () => {
  it('parses the raw photo response body once as the standard API envelope', async () => {
    const response = {
      status: 200,
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: vi
        .fn()
        .mockResolvedValue(JSON.stringify({ success: true, data: result })),
      json: vi.fn().mockRejectedValue(new Error('json must not be called')),
    } as unknown as Response;

    await expect(
      parseApiResponse(response, photoAnalysisResultSchema),
    ).resolves.toEqual(result);
    expect(response.text).toHaveBeenCalledOnce();
    expect(response.json).not.toHaveBeenCalled();
  });

  it('automatically accepts every valid trusted row without a second trust confirmation', () => {
    const rows = photoRowsFromAnalysis(result);
    expect(rows[0]?.status).toBe('confirmed');
    expect(photoRowsDisposition(rows).canContinue).toBe(true);
    const confirmed = confirmPhotoRow(rows[0]!);
    expect(confirmed.status).toBe('confirmed');
    expect(photoRowsDisposition([confirmed]).canContinue).toBe(true);
  });

  it('keeps a trusted canonical food in serving review without selecting 100 g', () => {
    const row = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          loggable: false,
          reviewStatus: 'needs_review',
          provisionalPortion: {
            rawQuantityText: null,
            rawServingText: null,
            confidence: null,
            parsed: {
              status: 'missing',
              quantity: null,
              unit: null,
              reason: 'no_explicit_serving',
              rawQuantityText: null,
              rawServingText: null,
            },
            quantity: {
              state: 'no_responsible_estimate',
              source: 'unresolved_visible_portion',
            },
            servingResolution: 'needs_review',
            resolvedServing: {
              status: 'needs_review',
              quantity: null,
              unit: null,
              servingOptionId: null,
              multiplier: null,
              method: null,
              reason: 'no_quantity',
              source: 'unresolved_visible_portion',
              reviewRequired: true,
            },
          },
          adjudication: {
            selectionSource: 'deterministic',
            status: 'not_needed',
            confidence: null,
            reviewReason: 'portion_needs_review',
          },
        },
      ],
    })[0]!;

    expect(row.disposition).toBe('trusted');
    expect(row.amount).toBe('');
    expect(row.unit).toBe('g');
    expect(JSON.stringify(row)).not.toContain('100 g');
    expect(photoRowReason(row)).toBe(
      'Enter an amount greater than 0 and no more than 10,000.',
    );
    expect(photoRowsDisposition([row]).canContinue).toBe(false);
  });

  it('prefills a low-confidence detected amount while keeping serving review required', () => {
    const lowConfidence = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          loggable: false,
          reviewStatus: 'needs_review',
          provisionalPortion: {
            ...result.items[0]!.provisionalPortion!,
            confidence: 'low',
            quantity: {
              state: 'estimated',
              amount: 35,
              unit: 'gram',
              countLabel: null,
              rawText: 'approximately 35 grams',
              confidence: 'low',
              source: 'vision_structured',
            },
            resolvedServing: {
              status: 'needs_review',
              quantity: 35,
              unit: 'g',
              servingOptionId: null,
              multiplier: 0.35,
              method: 'mass_conversion',
              reason: 'low_confidence',
              source: 'deterministic_conversion',
              reviewRequired: true,
            },
          },
          adjudication: {
            selectionSource: 'deterministic',
            status: 'not_needed',
            confidence: null,
            reviewReason: 'portion_needs_review',
          },
        },
      ],
    })[0]!;

    expect(lowConfidence.disposition).toBe('trusted');
    expect(lowConfidence.amount).toBe('35');
    expect(lowConfidence.unit).toBe('g');
    expect(photoRowReason(lowConfidence)).toBeNull();
    const confirmed = confirmPhotoRow(lowConfidence);
    expect(confirmed.status).toBe('confirmed');
    expect(photoRowsDisposition([confirmed]).canContinue).toBe(true);
  });

  it('initializes the gram editor from normalized grams instead of the observed household value', () => {
    const row = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          provisionalPortion: {
            ...result.items[0]!.provisionalPortion!,
            parsed: {
              status: 'parsed',
              quantity: 2,
              unit: 'tbsp',
              rawQuantityText: '2',
              rawServingText: '2 tbsp',
            },
            quantity: {
              state: 'estimated',
              amount: 2,
              unit: 'tablespoon',
              countLabel: null,
              rawText: 'approximately 2 tablespoons',
              confidence: 'medium',
              source: 'vision_structured',
              massEstimateGrams: 10,
              massEstimateConfidence: 'medium',
            },
            resolvedServing: {
              status: 'needs_review',
              quantity: 2,
              unit: 'tbsp',
              servingOptionId: null,
              multiplier: null,
              method: 'ai_photo_mass_estimate',
              reason: 'low_confidence',
              source: 'vision_structured',
              reviewRequired: true,
              normalizedGrams: 10,
              normalizedGramsConfidence: 'medium',
              normalizationMethod: 'ai_photo_mass_estimate',
              requiresUserReview: true,
            },
          },
          loggable: false,
          reviewStatus: 'needs_review',
        },
      ],
    })[0]!;

    expect(row.amount).toBe('10');
    expect(row.unit).toBe('g');
    expect(row.recognizedItem.provisionalPortion?.quantity).toMatchObject({
      amount: 2,
      unit: 'tablespoon',
    });
  });

  it('keeps a provider-resolved household serving selected while retaining normalized grams', () => {
    const providerFood = {
      ...food,
      servingOptions: {
        schemaVersion: 1 as const,
        options: [
          {
            id: 'tbsp-1',
            label: '1 tablespoon',
            quantity: 1,
            unit: 'tbsp',
            unitFamily: 'household' as const,
            equivalentWeightGrams: 5,
            equivalentVolumeMl: 15,
            source: 'provider' as const,
            trust: 'trusted' as const,
            provider: 'usda_fdc' as const,
            providerDescription: 'tablespoon',
          },
        ],
      },
    } satisfies FoodItem;
    const row = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          candidates: [{ ...candidate, foodItem: providerFood }],
          provisionalPortion: {
            ...result.items[0]!.provisionalPortion!,
            parsed: {
              status: 'parsed',
              quantity: 2,
              unit: 'tbsp',
              rawQuantityText: '2',
              rawServingText: '2 tbsp',
            },
            quantity: {
              state: 'estimated',
              amount: 2,
              unit: 'tablespoon',
              countLabel: null,
              rawText: 'approximately 2 tablespoons',
              confidence: 'medium',
              source: 'vision_structured',
            },
            resolvedServing: {
              status: 'resolved',
              quantity: 2,
              unit: 'tbsp',
              servingOptionId: 'tbsp-1',
              multiplier: 0.1,
              method: 'provider_serving',
              reason: null,
              source: 'provider_serving',
              reviewRequired: false,
              normalizedGrams: 10,
              normalizedGramsConfidence: 'medium',
              normalizationMethod: 'provider_serving_conversion',
              requiresUserReview: false,
            },
          },
          loggable: true,
          reviewStatus: 'matched',
        },
      ],
    })[0]!;

    expect(row.amount).toBe('2');
    expect(row.unit).toBe('tbsp');
    expect(row.servingOptionId).toBe('tbsp-1');
    expect(photoRowServingChoices(row).map((choice) => choice.unit)).toEqual(
      expect.arrayContaining(['tbsp', 'g', 'oz']),
    );
    expect(
      row.recognizedItem.provisionalPortion?.resolvedServing,
    ).toMatchObject({ normalizedGrams: 10 });
    const grams = changePhotoServingChoice(row, {
      id: 'unit:g',
      label: 'g',
      unit: 'g',
      servingOptionId: null,
      quantity: 100,
    });
    expect(grams).toMatchObject({ amount: '10', unit: 'g' });
  });

  it('automatically accepts a trusted canonical row with a valid reviewed amount', () => {
    const row = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          loggable: false,
          reviewStatus: 'needs_review',
          provisionalPortion: {
            ...result.items[0]!.provisionalPortion!,
            resolvedServing: {
              status: 'needs_review',
              quantity: 10,
              unit: 'g',
              servingOptionId: null,
              multiplier: 0.1,
              method: 'mass_conversion',
              reason: 'low_confidence',
              source: 'deterministic_conversion',
              reviewRequired: true,
              normalizedGrams: 10,
              normalizedGramsConfidence: 'medium',
              normalizationMethod: 'ai_photo_mass_estimate',
              requiresUserReview: true,
            },
          },
        },
      ],
    })[0]!;

    expect(row.disposition).toBe('trusted');
    expect(row.status).toBe('confirmed');
    expect(photoRowReason(row)).toBeNull();
    expect(photoRowsDisposition([row]).canContinue).toBe(true);
  });

  it('leaves the gram editor blank when an observed household amount has no mass resolution', () => {
    const row = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          provisionalPortion: {
            ...result.items[0]!.provisionalPortion!,
            parsed: {
              status: 'parsed',
              quantity: 2,
              unit: 'tbsp',
              rawQuantityText: '2',
              rawServingText: '2 tbsp',
            },
            quantity: {
              state: 'estimated',
              amount: 2,
              unit: 'tablespoon',
              countLabel: null,
              rawText: 'approximately 2 tablespoons',
              confidence: 'medium',
              source: 'vision_structured',
            },
            resolvedServing: {
              status: 'needs_review',
              quantity: 2,
              unit: 'tbsp',
              servingOptionId: null,
              multiplier: null,
              method: null,
              reason: 'no_safe_conversion',
              source: 'vision_structured',
              reviewRequired: true,
              normalizedGrams: null,
              normalizationMethod: 'unresolved',
              requiresUserReview: true,
            },
          },
          loggable: false,
          reviewStatus: 'needs_review',
        },
      ],
    })[0]!;

    expect(row.disposition).toBe('trusted');
    expect(row.amount).toBe('');
    expect(row.unit).toBe('g');
    expect(row.recognizedItem.provisionalPortion?.quantity).toMatchObject({
      amount: 2,
      unit: 'tablespoon',
    });
    expect(photoRowsDisposition([row]).canContinue).toBe(false);
  });

  it('allows save when every visible trusted row already has a valid amount', () => {
    const first = confirmPhotoRow(photoRowsFromAnalysis(result)[0]!);
    const second = addPhotoRow(candidate, 1);
    expect(photoRowsDisposition([first, second]).canContinue).toBe(true);
    expect(
      photoRowsDisposition([first, { ...second, status: 'excluded' }])
        .canContinue,
    ).toBe(true);
  });

  it('keeps separate backend component rows independently reviewable', () => {
    const secondFood = {
      ...food,
      id: '00000000-0000-4000-8000-000000000011',
      name: 'Visible topping',
    };
    const secondCandidate = {
      ...candidate,
      foodItem: secondFood,
    };
    const rows = photoRowsFromAnalysis({
      ...result,
      items: [
        result.items[0]!,
        {
          ...result.items[0]!,
          id: 'photo-item-2',
          recognizedName: 'Visible topping',
          selectedCandidateId: secondFood.id,
          candidates: [secondCandidate],
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => photoRowDisplayName(row))).toEqual([
      'Chicken breast',
      'Visible topping',
    ]);
    const firstConfirmed = confirmPhotoRow(rows[0]!);
    const secondExcluded = setPhotoRowDisposition(rows[1]!, 'excluded');
    expect(
      photoRowsDisposition([firstConfirmed, secondExcluded]),
    ).toMatchObject({
      canContinue: true,
      included: [firstConfirmed],
      excluded: [secondExcluded],
      unresolved: [],
    });
  });

  it('supports candidate replacement and keeps serving review pending', () => {
    const rows = photoRowsFromAnalysis(result);
    const replacement = {
      ...candidate,
      foodItem: {
        ...food,
        id: '00000000-0000-4000-8000-000000000011',
        name: 'Roasted chicken',
      },
    };
    const next = replacePhotoRowCandidate(rows[0]!, replacement);
    expect(next.selectedCandidateId).toBe(replacement.foodItem.id);
    expect(next.status).toBe('pending');
    expect(next.candidateReviewed).toBe(true);
  });

  it('keeps an unsupported household serving out of the confirmed state', () => {
    const household = {
      ...result,
      items: [
        {
          ...result.items[0]!,
          provisionalPortion: {
            ...result.items[0]!.provisionalPortion!,
            parsed: {
              status: 'parsed' as const,
              quantity: 1,
              unit: 'cup' as const,
              rawQuantityText: '1',
              rawServingText: '1 cup',
            },
          },
        },
      ],
    } satisfies PhotoAnalysisResult;
    const row = confirmPhotoRow(photoRowsFromAnalysis(household)[0]!);
    expect(row.status).toBe('pending');
    expect(photoRowsDisposition([row]).canContinue).toBe(false);
  });

  it('keeps rows with no trusted candidate unresolved', () => {
    const unresolved = {
      ...result,
      items: [
        {
          ...result.items[0]!,
          selectedCandidateId: null,
          candidates: [],
          loggable: false,
        },
      ],
    } satisfies PhotoAnalysisResult;
    const row = photoRowsFromAnalysis(unresolved)[0]!;
    expect(confirmPhotoRow(row).status).toBe('pending');
    expect(photoRowsDisposition([row]).blockedReasons[row.id]).toContain(
      'trusted food',
    );
  });

  it('keeps low-trust estimates visible as metadata but outside trusted save input', () => {
    const estimated = {
      ...result,
      items: [
        {
          ...result.items[0]!,
          selectedCandidateId: null,
          candidates: [],
          loggable: false,
          estimatedNutrition: {
            calories: 300,
            proteinGrams: 12,
            carbohydrateGrams: 35,
            fatGrams: 10,
            confidence: 'low' as const,
            basis: 'portion_shown' as const,
            source: 'ai_estimate' as const,
            trust: 'low' as const,
            editable: true as const,
            linkedFoodItemId: null,
            label: 'Estimated for portion shown',
          },
        },
      ],
    } satisfies PhotoAnalysisResult;

    const row = photoRowsFromAnalysis(estimated)[0]!;
    expect(row.recognizedItem.estimatedNutrition?.trust).toBe('low');
    expect(photoRowsDisposition([row]).canContinue).toBe(false);
    expect(() =>
      photoRowsSaveRequest({
        rows: [row],
        mealType: 'lunch',
        loggedAt: '2026-07-13T18:00:00.000Z',
      }),
    ).toThrow('Every included photo row must have a valid serving');
  });

  it('adds a missed food as a distinct user-added row', () => {
    const row = addPhotoRow(candidate, 1);
    expect(row.id).toBe('photo-item-2');
    expect(row.addedByUser).toBe(true);
    expect(row.recognizedItem.recognizedName).toBe(food.name);
  });

  it('projects trusted nutrition and never builds nutrition into the save request', () => {
    const row = confirmPhotoRow(photoRowsFromAnalysis(result)[0]!);
    expect(photoNutritionProjection(row, 'simple')).toMatchObject({
      calories: 248,
      protein: 46.5,
      carbs: null,
      fat: null,
    });
    const request = photoRowsSaveRequest({
      rows: [row],
      mealType: 'lunch',
      loggedAt: '2026-07-13T18:00:00.000Z',
    });
    expect(request.items[0]).toMatchObject({
      candidateType: 'food_item',
      foodItemId: food.id,
      serving: { quantity: 150, unit: 'g' },
    });
    expect(JSON.stringify(request)).not.toContain('calories');
    expect(JSON.stringify(request)).not.toContain('photo');
    expect(JSON.stringify(request)).not.toContain('userId');
  });

  it('does not use provider nutrition and keeps unknown detailed fields unknown', () => {
    const row = confirmPhotoRow(photoRowsFromAnalysis(result)[0]!);
    const projection = photoNutritionProjection(row, 'complex');
    expect(projection?.carbs).toBe(0);
    expect(projection?.nutrients.potassium).toEqual({
      amount: 384,
      unit: 'mg',
    });
  });
});

describe('mixed photo review dispositions', () => {
  const estimate = {
    calories: 300,
    proteinGrams: 12,
    carbohydrateGrams: 35,
    fatGrams: 10,
    confidence: 'low' as const,
    basis: 'portion_shown' as const,
    source: 'ai_estimate' as const,
    trust: 'low' as const,
    editable: true as const,
    linkedFoodItemId: null,
    label: 'Estimated for portion shown',
    estimateProof: 'opaque-server-proof',
  };

  function estimatedAnalysis(
    overrides: Partial<PhotoAnalysisResult['items'][number]> = {},
  ): PhotoAnalysisResult {
    return {
      ...result,
      items: [
        {
          ...result.items[0]!,
          selectedCandidateId: null,
          candidates: [],
          loggable: false,
          estimatedNutrition: estimate,
          ...overrides,
        },
      ],
    };
  }

  it('defaults strong deterministic and high-confidence adjudicated rows to trusted', () => {
    const deterministic = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          adjudication: {
            selectionSource: 'deterministic',
            status: 'not_needed',
            confidence: null,
            reviewReason: null,
          },
        },
      ],
    })[0]!;
    const adjudicated = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          adjudication: {
            selectionSource: 'ai_adjudicated',
            status: 'selected',
            confidence: 'high',
            reviewReason: null,
          },
        },
      ],
    }).at(0)!;

    expect(deterministic.disposition).toBe('trusted');
    expect(adjudicated.disposition).toBe('trusted');
  });

  it('defaults a backend-materialized deterministic external winner to trusted', () => {
    const materialized = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          reviewStatus: 'matched',
          loggable: true,
          adjudication: {
            selectionSource: 'deterministic',
            status: 'selected',
            confidence: 'high',
            reviewReason: null,
          },
        },
      ],
    })[0]!;

    expect(materialized.disposition).toBe('trusted');
    expect(materialized.selectedCandidateId).toBe(food.id);
  });

  it('auto-confirms a backend-materialized external row without another trust step', () => {
    const externalFood: FoodItem = {
      ...food,
      id: '00000000-0000-4000-8000-000000000013',
      name: 'Materialized external food',
      sourceType: 'cached_external',
      sourceProvider: 'usda_fdc',
      sourceId: '173944',
    };
    const canonicalCandidate = {
      ...candidate,
      foodItem: externalFood,
      matchReason: 'usda_fdc' as const,
    };
    const row = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          selectedCandidateId: externalFood.id,
          candidates: [canonicalCandidate],
          reviewStatus: 'matched',
          loggable: true,
          adjudication: {
            selectionSource: 'deterministic',
            status: 'selected',
            confidence: 'high',
            reviewReason: null,
          },
        },
      ],
    })[0]!;

    expect(row.disposition).toBe('trusted');
    expect(row.candidateReviewed).toBe(true);
    expect(row.status).toBe('confirmed');
    expect(photoRowsDisposition([row]).canContinue).toBe(true);
  });

  it('defaults a usable signed estimate to estimated and missing proof to unresolved', () => {
    const estimated = photoRowsFromAnalysis(estimatedAnalysis())[0]!;
    const { estimateProof, ...estimateWithoutProof } = estimate;
    void estimateProof;
    const unresolved = photoRowsFromAnalysis(
      estimatedAnalysis({
        estimatedNutrition: estimateWithoutProof,
      }),
    )[0]!;

    expect(estimated.disposition).toBe('estimated');
    expect(unresolved.disposition).toBe('unresolved');
  });

  it('defaults an unavailable USDA candidate plus valid estimate proof to estimated', () => {
    const unavailableCandidate = {
      candidateType: 'external_food' as const,
      foodItem: null,
      externalFood: {
        sourceProvider: 'usda_fdc' as const,
        sourceId: 'unavailable-123',
        name: 'Unavailable USDA candidate',
        brandName: null,
        foodType: 'generic' as const,
        servingBasisText: 'USDA nutrition details unavailable (timeout)',
        servingQuantity: null,
        servingUnit: null,
        servingWeightGrams: null,
        servingOptions: null,
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
        sugar: null,
        sodium: null,
        nutrients: {},
      },
      rank: 1,
      matchReason: 'usda_fdc' as const,
      confidence: 'low' as const,
      defaultServingMultiplier: 1,
    } satisfies AiFoodParseCandidate;
    const row = photoRowsFromAnalysis(
      estimatedAnalysis({
        selectedCandidateId: 'usda_fdc:unavailable-123',
        candidates: [unavailableCandidate],
      }),
    )[0]!;

    expect(row.disposition).toBe('estimated');
    expect(photoRowLabelSource(row)).toBe('ai_estimate');
    expect(photoRowStatusLabel(row)).toBe('AI estimate · low trust');
    expect(photoRowReason(row)).toBeNull();
  });

  it('does not submit an incompatible external candidate as trusted', () => {
    const external = {
      candidateType: 'external_food' as const,
      foodItem: null,
      externalFood: {
        sourceProvider: 'usda_fdc' as const,
        sourceId: 'usda-123',
        name: 'External chicken',
        brandName: null,
        foodType: 'generic' as const,
        servingBasisText: '100 g',
        servingQuantity: 100,
        servingUnit: 'g',
        servingWeightGrams: 100,
        servingOptions: null,
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        fiber: null,
        sugar: null,
        sodium: null,
        nutrients: {},
      },
      rank: 1,
      matchReason: 'usda_fdc' as const,
      confidence: 'high' as const,
      defaultServingMultiplier: 1,
    };
    const row = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          selectedCandidateId: 'usda_fdc:usda-123',
          candidates: [external],
          estimatedNutrition: estimate,
        },
      ],
    })[0]!;

    expect(row.disposition).toBe('estimated');
    expect(() =>
      photoRowsMixedConfirmationRequest({
        rows: [{ ...row, disposition: 'trusted' }],
        mealType: 'lunch',
        loggedAt: '2026-07-13T18:00:00.000Z',
      }),
    ).toThrow('compatible');
  });

  it('turns a resolved external candidate into a canonical trusted candidate', () => {
    const external = {
      candidateType: 'external_food' as const,
      foodItem: null,
      externalFood: {
        sourceProvider: 'usda_fdc' as const,
        sourceId: '173944',
        name: 'Bananas, raw',
        brandName: null,
        foodType: 'generic' as const,
        servingBasisText: 'per 100 g',
        servingQuantity: 100,
        servingUnit: 'g',
        servingWeightGrams: 100,
        servingOptions: null,
        calories: 89,
        protein: 1.1,
        carbs: 22.8,
        fat: 0.3,
        fiber: 2.6,
        sugar: 12.2,
        sodium: 1,
        nutrients: {},
      },
      rank: 1,
      matchReason: 'usda_fdc' as const,
      confidence: 'high' as const,
      defaultServingMultiplier: 1,
    } satisfies AiFoodParseCandidate;
    const canonical = {
      ...food,
      id: '00000000-0000-4000-8000-000000000011',
      name: 'Bananas, raw',
      sourceType: 'cached_external' as const,
      sourceProvider: 'usda_fdc' as const,
      sourceId: '173944',
    };
    const resolved = materializePhotoCandidate(external, canonical);

    expect(resolved).toMatchObject({
      candidateType: 'food_item',
      foodItem: canonical,
      externalFood: null,
      rank: 1,
      matchReason: 'usda_fdc',
    });

    const externalRow = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          selectedCandidateId: null,
          candidates: [external],
          estimatedNutrition: estimate,
        },
      ],
    })[0]!;
    const trustedRow = replacePhotoRowCandidate(externalRow, resolved);
    expect(trustedRow.disposition).toBe('trusted');
    expect(trustedRow.candidateReviewed).toBe(true);
    expect(trustedRow.status).toBe('confirmed');
    expect(trustedRow.recognizedItem.estimatedNutrition).toBeUndefined();
    expect(trustedRow.estimateDraft).toBeUndefined();
    expect(
      trustedRow.recognizedItem.candidates.some(
        (value) => value.candidateType === 'external_food',
      ),
    ).toBe(false);
    expect(photoRowsDisposition([trustedRow]).canContinue).toBe(true);
    expect(() =>
      photoRowsMixedConfirmationRequest({
        rows: [
          {
            ...trustedRow,
            candidateReviewed: true,
            status: 'confirmed',
          },
        ],
        mealType: 'lunch',
        loggedAt: '2026-07-13T18:00:00.000Z',
      }),
    ).not.toThrow();
  });

  it('exposes an actionable external resolution state through materializing and trusted', () => {
    const external = {
      candidateType: 'external_food' as const,
      foodItem: null,
      externalFood: {
        sourceProvider: 'usda_fdc' as const,
        sourceId: '173944',
        name: 'External food',
        brandName: null,
        foodType: 'generic' as const,
        servingBasisText: 'per 100 g',
        servingQuantity: 100,
        servingUnit: 'g',
        servingWeightGrams: 100,
        servingOptions: null,
        calories: 89,
        protein: 1.1,
        carbs: 22.8,
        fat: 0.3,
        fiber: null,
        sugar: null,
        sodium: null,
        nutrients: {},
      },
      rank: 1,
      matchReason: 'usda_fdc' as const,
      confidence: 'high' as const,
      defaultServingMultiplier: 1,
    } satisfies AiFoodParseCandidate;
    const row = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          selectedCandidateId: photoCandidateId(external),
          candidates: [external],
          loggable: false,
          reviewStatus: 'needs_review',
        },
      ],
    })[0]!;

    expect(photoExternalResolutionState(row)).toBe('available');
    expect(photoExternalResolutionState(row, { resolving: true })).toBe(
      'materializing',
    );
    expect(
      photoExternalResolutionState(row, {
        failure: 'Provider food could not be resolved.',
      }),
    ).toBe('failed');

    const resolved = replacePhotoRowCandidate(
      row,
      materializePhotoCandidate(external, {
        ...food,
        id: '00000000-0000-4000-8000-000000000012',
      }),
    );
    expect(photoExternalResolutionState(resolved)).toBe('trusted');
    expect(resolved.disposition).toBe('trusted');
  });

  it('does not present an unavailable external candidate as resolvable', () => {
    const external = {
      candidateType: 'external_food' as const,
      foodItem: null,
      externalFood: {
        sourceProvider: 'usda_fdc' as const,
        sourceId: 'unavailable-1',
        name: 'Unavailable external food',
        brandName: null,
        foodType: 'generic' as const,
        servingBasisText: 'temporarily unavailable',
        servingQuantity: null,
        servingUnit: null,
        servingWeightGrams: null,
        servingOptions: null,
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
        sugar: null,
        sodium: null,
        nutrients: {},
      },
      rank: 1,
      matchReason: 'usda_fdc' as const,
      confidence: 'low' as const,
      defaultServingMultiplier: 1,
    } satisfies AiFoodParseCandidate;
    const row = photoRowsFromAnalysis({
      ...result,
      items: [
        {
          ...result.items[0]!,
          selectedCandidateId: photoCandidateId(external),
          candidates: [external],
          loggable: false,
          reviewStatus: 'needs_review',
        },
      ],
    })[0]!;

    expect(photoExternalResolutionState(row)).toBe('unavailable');
  });

  it('uses normal back history and route-specific fallback without dispatching an unhandled back action', () => {
    const actions: string[] = [];
    safePhotoLogBack({
      canGoBack: () => true,
      back: () => actions.push('back'),
      replace: () => actions.push('replace'),
      fallback: '/photo-log',
    });
    safePhotoLogBack({
      canGoBack: () => false,
      back: () => actions.push('back'),
      replace: (route) => actions.push(`replace:${route}`),
      fallback: '/(tabs)/history',
    });

    expect(actions).toEqual(['back', 'replace:/(tabs)/history']);
  });

  it('supports trusted, estimated, and excluded transitions without two active dispositions', () => {
    const trusted = photoRowsFromAnalysis(result)[0]!;
    const excluded = setPhotoRowDisposition(trusted, 'excluded');
    const restored = restorePhotoRow(excluded);
    const estimated = photoRowsFromAnalysis(estimatedAnalysis())[0]!;
    const estimatedExcluded = setPhotoRowDisposition(estimated, 'excluded');

    expect(excluded.disposition).toBe('excluded');
    expect(excluded.status).toBe('excluded');
    expect(restored.disposition).toBe('trusted');
    expect(estimatedExcluded.disposition).toBe('excluded');
    expect(restorePhotoRow(estimatedExcluded).disposition).toBe('estimated');
    expect(
      setPhotoRowDisposition(restorePhotoRow(estimatedExcluded), 'estimated')
        .disposition,
    ).toBe('estimated');
    expect(setPhotoRowIncluded(trusted, false).disposition).toBe('excluded');
    expect(
      setPhotoRowIncluded(setPhotoRowIncluded(trusted, false), true)
        .disposition,
    ).toBe('trusted');
  });

  it('edits estimates with field-level validation and keeps proof and basis immutable', () => {
    const row = photoRowsFromAnalysis(estimatedAnalysis())[0]!;
    const edited = updatePhotoEstimateDraft(
      updatePhotoEstimateDraft(row, 'foodName', 'Corrected bowl'),
      'proteinGrams',
      '20',
    );

    expect(photoEstimateValidation(edited)).toEqual({});
    expect(edited.estimateDraft?.foodName).toBe('Corrected bowl');
    expect(edited.estimateDraft?.proteinGrams).toBe('20');
    expect(edited.recognizedItem.estimatedNutrition?.estimateProof).toBe(
      'opaque-server-proof',
    );
    expect(edited.recognizedItem.estimatedNutrition?.basis).toBe(
      'portion_shown',
    );
    expect(
      photoEstimateValidation(updatePhotoEstimateDraft(edited, 'calories', '0'))
        .calories,
    ).toContain('greater than 0');
    expect(
      photoEstimateValidation(
        updatePhotoEstimateDraft(edited, 'fatGrams', '-1'),
      ).fatGrams,
    ).toContain('0 or higher');
    expect(
      photoEstimateValidation(
        updatePhotoEstimateDraft(edited, 'calories', 'not-a-number'),
      ).calories,
    ).toBeDefined();
  });

  it('builds one ordered mixed request with strict row payloads', () => {
    const trusted = photoRowsFromAnalysis(result)[0]!;
    const confirmedTrusted = confirmPhotoRow(trusted);
    const estimated = photoRowsFromAnalysis(estimatedAnalysis())[0]!;
    const editedEstimated = updatePhotoEstimateDraft(
      updatePhotoEstimateDraft(
        { ...estimated, id: 'photo-item-2' as const },
        'foodName',
        'Corrected meal',
      ),
      'calories',
      '350',
    );
    const excluded = setPhotoRowDisposition(
      { ...estimated, id: 'photo-item-3' as const },
      'excluded',
    );

    const request = photoRowsMixedConfirmationRequest({
      rows: [confirmedTrusted, editedEstimated, excluded],
      mealType: 'lunch',
      loggedAt: '2026-07-13T18:00:00.000Z',
    });

    expect(request.entries.map((entry) => entry.rowRef)).toEqual([
      confirmedTrusted.id,
      editedEstimated.id,
      excluded.id,
    ]);
    expect(request.entries[0]).toMatchObject({
      rowRef: confirmedTrusted.id,
      disposition: 'trusted',
      candidateId: food.id,
      serving: { quantity: 150, unit: 'g' },
    });
    expect(request.entries[0]).not.toHaveProperty('calories');
    expect(request.entries[1]).toMatchObject({
      disposition: 'estimated',
      estimateProof: 'opaque-server-proof',
      confirmedFoodName: 'Corrected meal',
      userAdjustedNutrition: {
        calories: 350,
        proteinGrams: 12,
        carbohydrateGrams: 35,
        fatGrams: 10,
      },
    });
    expect(request.entries[2]).toEqual({
      rowRef: excluded.id,
      disposition: 'excluded',
    });
  });

  it('omits unchanged estimate corrections and sends only explicit changed fields', () => {
    const original = photoRowsFromAnalysis(estimatedAnalysis())[0]!;
    const unchanged = photoRowsMixedConfirmationRequest({
      rows: [original],
      mealType: 'lunch',
      loggedAt: '2026-07-13T18:00:00.000Z',
    });
    expect(unchanged.entries[0]).toEqual({
      rowRef: original.id,
      disposition: 'estimated',
      estimateProof: 'opaque-server-proof',
    });

    const macroOnly = photoRowsMixedConfirmationRequest({
      rows: [updatePhotoEstimateDraft(original, 'fatGrams', '12')],
      mealType: 'lunch',
      loggedAt: '2026-07-13T18:00:00.000Z',
    });
    expect(macroOnly.entries[0]).toMatchObject({
      disposition: 'estimated',
      userAdjustedNutrition: {
        calories: 300,
        proteinGrams: 12,
        carbohydrateGrams: 35,
        fatGrams: 12,
      },
    });
    expect(macroOnly.entries[0]).not.toHaveProperty('confirmedFoodName');

    const nameOnly = photoRowsMixedConfirmationRequest({
      rows: [updatePhotoEstimateDraft(original, 'foodName', 'My bowl')],
      mealType: 'lunch',
      loggedAt: '2026-07-13T18:00:00.000Z',
    });
    expect(nameOnly.entries[0]).toEqual({
      rowRef: original.id,
      disposition: 'estimated',
      estimateProof: 'opaque-server-proof',
      confirmedFoodName: 'My bowl',
    });
  });

  it('uses shared estimate bounds and conservative energy consistency', () => {
    const row = photoRowsFromAnalysis(estimatedAnalysis())[0]!;
    expect(
      photoEstimateValidation(updatePhotoEstimateDraft(row, 'calories', '5001'))
        .calories,
    ).toContain('5000');
    expect(
      photoEstimateValidation(
        updatePhotoEstimateDraft(row, 'proteinGrams', '501'),
      ).proteinGrams,
    ).toContain('500');
    const inconsistent = updatePhotoEstimateDraft(
      updatePhotoEstimateDraft(row, 'calories', '2000'),
      'proteinGrams',
      '1',
    );
    expect(photoEstimateValidation(inconsistent).calories).toContain(
      'inconsistent',
    );
  });

  it('switches an estimated row to a compatible trusted candidate without changing estimate metadata', () => {
    const estimated = photoRowsFromAnalysis(estimatedAnalysis())[0]!;
    const next = replacePhotoRowCandidate(estimated, candidate);
    expect(next.disposition).toBe('trusted');
    expect(next.status).toBe('pending');
    expect(next.recognizedItem.estimatedNutrition).toEqual(
      estimated.recognizedItem.estimatedNutrition,
    );
    expect(next.estimateDraft).toEqual(estimated.estimateDraft);
  });

  it('blocks unresolved and all-excluded requests and rejects duplicate row references', () => {
    const withoutEstimate = { ...estimatedAnalysis().items[0]! };
    delete withoutEstimate.estimatedNutrition;
    const unresolved = photoRowsFromAnalysis({
      ...estimatedAnalysis(),
      items: [withoutEstimate],
    })[0]!;
    expect(() =>
      photoRowsMixedConfirmationRequest({
        rows: [unresolved],
        mealType: 'lunch',
        loggedAt: '2026-07-13T18:00:00.000Z',
      }),
    ).toThrow('unresolved');

    const excluded = setPhotoRowDisposition(
      { ...unresolved, id: 'photo-item-2' as const },
      'excluded',
    );
    expect(() =>
      photoRowsMixedConfirmationRequest({
        rows: [excluded],
        mealType: 'lunch',
        loggedAt: '2026-07-13T18:00:00.000Z',
      }),
    ).toThrow('at least one');
    expect(() =>
      photoRowsMixedConfirmationRequest({
        rows: [
          { ...confirmedRowForRequest(), id: 'photo-item-1' as const },
          { ...confirmedRowForRequest(), id: 'photo-item-1' as const },
        ],
        mealType: 'lunch',
        loggedAt: '2026-07-13T18:00:00.000Z',
      }),
    ).toThrow('once');
  });

  function confirmedRowForRequest() {
    return confirmPhotoRow(photoRowsFromAnalysis(result)[0]!);
  }
});

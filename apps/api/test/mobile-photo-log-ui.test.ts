import { describe, expect, it, vi } from 'vitest';
import type { FoodItem, PhotoAnalysisResult } from '@food-tracker/shared';
import {
  addPhotoRow,
  confirmPhotoRow,
  ensurePhotoLibraryPermission,
  photoNutritionProjection,
  photoRowsDisposition,
  photoRowsFromAnalysis,
  photoRowsSaveRequest,
  replacePhotoRowCandidate,
} from '../../mobile/src/lib/photo-log-ui.js';
import {
  cleanupPhotoFiles,
  readNormalizedPhotoBytes,
  normalizePhotoImageWithOperations,
  normalizedPhotoDimensions,
  orientationActions,
  photoAnalysisRequestInit,
  PhotoImageError,
} from '../../mobile/src/lib/photo-image-core.js';

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
    },
  ],
};

describe('mobile photo image helpers', () => {
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
  it('starts every recognized row pending and blocks until explicitly confirmed', () => {
    const rows = photoRowsFromAnalysis(result);
    expect(rows[0]?.status).toBe('pending');
    expect(photoRowsDisposition(rows).canContinue).toBe(false);
    const confirmed = confirmPhotoRow(rows[0]!);
    expect(confirmed.status).toBe('confirmed');
    expect(photoRowsDisposition([confirmed]).canContinue).toBe(true);
  });

  it('allows partial selection only after every visible row has a disposition', () => {
    const first = confirmPhotoRow(photoRowsFromAnalysis(result)[0]!);
    const second = addPhotoRow(candidate, 1);
    expect(photoRowsDisposition([first, second]).canContinue).toBe(false);
    expect(
      photoRowsDisposition([first, { ...second, status: 'excluded' }])
        .canContinue,
    ).toBe(true);
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
    expect(next.candidateReviewed).toBe(false);
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

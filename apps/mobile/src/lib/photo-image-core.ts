import {
  PHOTO_ANALYSIS_JPEG_MIME_TYPE,
  PHOTO_ANALYSIS_MAX_BYTES,
} from '@food-tracker/shared';

export const PHOTO_MAX_DIMENSION = 2048;
export const PHOTO_JPEG_QUALITY = 0.75;
export type PhotoFileOwnership =
  | 'user_library'
  | 'app_capture'
  | 'app_normalized';

export interface PhotoImageDimensions {
  width: number;
  height: number;
}
export interface NormalizedPhotoImage extends PhotoImageDimensions {
  uri: string;
  mimeType: typeof PHOTO_ANALYSIS_JPEG_MIME_TYPE;
  byteSize: number;
  ownership: 'app_normalized';
}

export class PhotoImageError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_DIMENSIONS'
      | 'NORMALIZATION_FAILED'
      | 'PHOTO_TOO_LARGE',
  ) {
    super(message);
  }
}

export class PhotoUploadError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'PHOTO_CANCELLED'
      | 'PHOTO_UNSUPPORTED_TYPE'
      | 'PHOTO_FILE_UNAVAILABLE'
      | 'PHOTO_FILE_READ_FAILED'
      | 'PHOTO_EMPTY'
      | 'PHOTO_TOO_LARGE'
      | 'PHOTO_INVALID_JPEG'
      | 'PHOTO_FILE_CHANGED',
  ) {
    super(message);
  }
}

export interface NormalizedPhotoFileReader {
  info: () => { exists: boolean; isDirectory?: boolean; size?: number };
  bytes: () => Promise<Uint8Array>;
}

function isJpegSignature(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

export async function readNormalizedPhotoBytes(input: {
  uri: string;
  mimeType: string;
  byteSize: number;
  signal: AbortSignal;
  openFile: (uri: string) => NormalizedPhotoFileReader;
}): Promise<{ bytes: Uint8Array; byteSize: number }> {
  if (input.signal.aborted) {
    throw new PhotoUploadError(
      'Photo analysis was cancelled.',
      'PHOTO_CANCELLED',
    );
  }
  if (input.mimeType !== PHOTO_ANALYSIS_JPEG_MIME_TYPE) {
    throw new PhotoUploadError(
      'The prepared photo is not a JPEG.',
      'PHOTO_UNSUPPORTED_TYPE',
    );
  }
  if (!Number.isFinite(input.byteSize) || input.byteSize <= 0) {
    throw new PhotoUploadError('The prepared photo is empty.', 'PHOTO_EMPTY');
  }
  if (input.byteSize > PHOTO_ANALYSIS_MAX_BYTES) {
    throw new PhotoUploadError(
      'The prepared photo is larger than 5 MiB.',
      'PHOTO_TOO_LARGE',
    );
  }

  let file: NormalizedPhotoFileReader;
  let info: ReturnType<NormalizedPhotoFileReader['info']>;
  try {
    file = input.openFile(input.uri);
    info = file.info();
  } catch {
    throw new PhotoUploadError(
      'The prepared photo could not be found.',
      'PHOTO_FILE_UNAVAILABLE',
    );
  }
  if (!info.exists || info.isDirectory === true || info.size === undefined) {
    throw new PhotoUploadError(
      'The prepared photo could not be found.',
      'PHOTO_FILE_UNAVAILABLE',
    );
  }
  if (info.size <= 0) {
    throw new PhotoUploadError('The prepared photo is empty.', 'PHOTO_EMPTY');
  }
  if (info.size > PHOTO_ANALYSIS_MAX_BYTES) {
    throw new PhotoUploadError(
      'The prepared photo is larger than 5 MiB.',
      'PHOTO_TOO_LARGE',
    );
  }

  let bytes: Uint8Array;
  try {
    bytes = await file.bytes();
  } catch {
    throw new PhotoUploadError(
      'The prepared photo could not be read.',
      'PHOTO_FILE_READ_FAILED',
    );
  }
  if (input.signal.aborted) {
    throw new PhotoUploadError(
      'Photo analysis was cancelled.',
      'PHOTO_CANCELLED',
    );
  }
  if (bytes.byteLength === 0) {
    throw new PhotoUploadError('The prepared photo is empty.', 'PHOTO_EMPTY');
  }
  if (bytes.byteLength > PHOTO_ANALYSIS_MAX_BYTES) {
    throw new PhotoUploadError(
      'The prepared photo is larger than 5 MiB.',
      'PHOTO_TOO_LARGE',
    );
  }
  if (bytes.byteLength !== info.size || bytes.byteLength !== input.byteSize) {
    throw new PhotoUploadError(
      'The prepared photo changed before upload.',
      'PHOTO_FILE_CHANGED',
    );
  }
  if (!isJpegSignature(bytes)) {
    throw new PhotoUploadError(
      'The prepared photo is not a valid JPEG.',
      'PHOTO_INVALID_JPEG',
    );
  }
  return { bytes, byteSize: bytes.byteLength };
}

export function photoAnalysisRequestInit(input: {
  bytes: ArrayBuffer;
  signal: AbortSignal;
}): {
  method: 'POST';
  headers: { Accept: 'application/json'; 'Content-Type': 'image/jpeg' };
  body: ArrayBuffer;
  signal: AbortSignal;
} {
  return {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'image/jpeg',
    },
    body: input.bytes,
    signal: input.signal,
  };
}

export function normalizedPhotoDimensions(
  width: number,
  height: number,
  maxDimension = PHOTO_MAX_DIMENSION,
): PhotoImageDimensions {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isFinite(maxDimension) ||
    maxDimension <= 0
  ) {
    throw new PhotoImageError(
      'The selected image has invalid dimensions.',
      'INVALID_DIMENSIONS',
    );
  }
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxDimension)
    return { width: Math.round(width), height: Math.round(height) };
  const scale = maxDimension / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function orientationActions(
  orientation: number | null | undefined,
): Array<{ rotate: number } | { flip: 'horizontal' | 'vertical' }> {
  switch (orientation) {
    case 2:
      return [{ flip: 'horizontal' }];
    case 3:
      return [{ rotate: 180 }];
    case 4:
      return [{ flip: 'vertical' }];
    case 5:
      return [{ rotate: 90 }, { flip: 'horizontal' }];
    case 6:
      return [{ rotate: 90 }];
    case 7:
      return [{ rotate: -90 }, { flip: 'horizontal' }];
    case 8:
      return [{ rotate: -90 }];
    default:
      return [];
  }
}

export interface PhotoFileOperations {
  delete: (uri: string) => Promise<void>;
}

export async function cleanupPhotoFiles(
  files: Array<{ uri: string; ownership: PhotoFileOwnership }>,
  operations: PhotoFileOperations,
): Promise<void> {
  const appOwnedUris = [
    ...new Set(
      files
        .filter((file) => file.ownership !== 'user_library')
        .map((file) => file.uri)
        .filter((uri) => uri.length > 0),
    ),
  ];
  await Promise.all(
    appOwnedUris.map(async (uri) => {
      try {
        await operations.delete(uri);
      } catch {
        /* best effort */
      }
    }),
  );
}

export async function normalizePhotoImageWithOperations(input: {
  uri: string;
  width: number;
  height: number;
  orientation?: number | null | undefined;
  manipulate: (
    uri: string,
    actions: Array<
      | { rotate: number }
      | { flip: 'horizontal' | 'vertical' }
      | { resize: PhotoImageDimensions }
    >,
    options: { compress: number; format: string },
  ) => Promise<{ uri: string; width: number; height: number }>;
  getInfo: (
    uri: string,
  ) => Promise<{ exists: boolean; isDirectory?: boolean; size?: number }>;
  cleanup: (uri: string) => Promise<void>;
}): Promise<NormalizedPhotoImage> {
  const dimensions = normalizedPhotoDimensions(input.width, input.height);
  try {
    const result = await input.manipulate(
      input.uri,
      [
        ...orientationActions(input.orientation),
        ...(dimensions.width === Math.round(input.width) &&
        dimensions.height === Math.round(input.height)
          ? []
          : [{ resize: dimensions }]),
      ],
      { compress: PHOTO_JPEG_QUALITY, format: 'jpeg' },
    );
    const info = await input.getInfo(result.uri);
    if (!info.exists || info.isDirectory === true || info.size === undefined)
      throw new PhotoImageError(
        'The image could not be prepared for upload.',
        'NORMALIZATION_FAILED',
      );
    if (info.size > PHOTO_ANALYSIS_MAX_BYTES) {
      await input.cleanup(result.uri).catch(() => undefined);
      throw new PhotoImageError(
        'The processed image is too large. Try a different photo.',
        'PHOTO_TOO_LARGE',
      );
    }
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      byteSize: info.size,
      mimeType: PHOTO_ANALYSIS_JPEG_MIME_TYPE,
      ownership: 'app_normalized',
    };
  } catch (error) {
    if (error instanceof PhotoImageError) throw error;
    throw new PhotoImageError(
      'The image could not be prepared. Try again.',
      'NORMALIZATION_FAILED',
    );
  }
}

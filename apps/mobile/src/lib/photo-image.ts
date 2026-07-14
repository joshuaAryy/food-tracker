import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import {
  cleanupPhotoFiles as cleanupCore,
  normalizePhotoImageWithOperations,
  orientationActions as coreOrientationActions,
  type PhotoFileOperations,
  type PhotoFileOwnership,
} from './photo-image-core';
import type { NormalizedPhotoImage } from './photo-image-core';

export * from './photo-image-core';
export type {
  NormalizedPhotoImage,
  PhotoFileOperations,
  PhotoFileOwnership,
} from './photo-image-core';

const defaultFileOperations: PhotoFileOperations = {
  delete: async (uri) => {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  },
};

export async function cleanupPhotoFiles(
  files: Array<{ uri: string; ownership: PhotoFileOwnership }>,
  operations: PhotoFileOperations = defaultFileOperations,
): Promise<void> {
  await cleanupCore(files, operations);
}

export async function normalizePhotoImage(input: {
  uri: string;
  width: number;
  height: number;
  orientation?: number | null;
  manipulate?: typeof ImageManipulator.manipulateAsync;
  getInfo?: typeof FileSystem.getInfoAsync;
  cleanup?: (uri: string) => Promise<void>;
}): Promise<NormalizedPhotoImage> {
  const manipulate = input.manipulate ?? ImageManipulator.manipulateAsync;
  const getInfo = input.getInfo ?? FileSystem.getInfoAsync;
  const cleanup = input.cleanup ?? defaultFileOperations.delete;
  return normalizePhotoImageWithOperations({
    uri: input.uri,
    width: input.width,
    height: input.height,
    orientation: input.orientation,
    manipulate: async (uri, actions, options) =>
      manipulate(
        uri,
        actions.map((action) =>
          'flip' in action
            ? {
                flip:
                  action.flip === 'horizontal'
                    ? ImageManipulator.FlipType.Horizontal
                    : ImageManipulator.FlipType.Vertical,
              }
            : action,
        ),
        {
          compress: options.compress,
          format: ImageManipulator.SaveFormat.JPEG,
        },
      ),
    getInfo: async (uri) => {
      const info = await getInfo(uri);
      return {
        exists: info.exists,
        ...(info.isDirectory === undefined
          ? {}
          : { isDirectory: info.isDirectory }),
        ...('size' in info && info.size !== undefined
          ? { size: info.size }
          : {}),
      };
    },
    cleanup,
  });
}

export function orientationActions(orientation: number | null | undefined) {
  return coreOrientationActions(orientation);
}

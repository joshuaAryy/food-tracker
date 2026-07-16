import { create } from 'zustand';
import type {
  RecipeEditorIngredientDraft,
  RecipeServingOperation,
  RecipeServingResult,
} from '@/lib/recipe-ui';
import type { MixedMealDraft } from '@/lib/mixed-meal-ui';
import type { FoodItem } from '@food-tracker/shared';
import type { PhotoReviewRow } from '@/lib/photo-log-ui';
import type { NormalizedPhotoImage } from '@/lib/photo-image-core';

export interface RecipeServingSession {
  context: 'recipe' | 'mixedMeal';
  key: string;
  operation: RecipeServingOperation;
  ingredientIndex: number;
  draft: RecipeEditorIngredientDraft;
}

interface AppState {
  dataVersion: number;
  markDataChanged: () => void;
  recipeServingSession: RecipeServingSession | null;
  recipeServingResult: (RecipeServingResult & { key: string }) | null;
  beginRecipeServing: (session: RecipeServingSession) => void;
  finishRecipeServing: (key: string, result: RecipeServingResult) => void;
  clearRecipeServingResult: (key: string) => void;
  mixedMealDraft: MixedMealDraft | null;
  setMixedMealDraft: (draft: MixedMealDraft) => void;
  clearMixedMealDraft: () => void;
  mixedMealManualResult: FoodItem | null;
  setMixedMealManualResult: (food: FoodItem) => void;
  clearMixedMealManualResult: () => void;
  photoLogSession: PhotoLogSession | null;
  beginPhotoLogSession: (session: PhotoLogSession) => void;
  setPhotoLogImage: (
    image: Pick<
      PhotoLogSession,
      | 'normalizedUri'
      | 'normalizedWidth'
      | 'normalizedHeight'
      | 'normalizedByteSize'
      | 'normalizedMimeType'
    >,
  ) => void;
  setPhotoLogRows: (rows: PhotoReviewRow[]) => void;
  updatePhotoLogRow: (
    id: string,
    update: (row: PhotoReviewRow) => PhotoReviewRow,
  ) => void;
  clearPhotoLogSession: () => void;
}

export interface PhotoLogSession {
  sessionId: string;
  source: 'camera' | 'library';
  originalUri: string;
  originalOwnership: 'user_library' | 'app_capture';
  normalizedUri: string;
  normalizedWidth: number;
  normalizedHeight: number;
  normalizedByteSize: number;
  normalizedMimeType: NormalizedPhotoImage['mimeType'];
  rows: PhotoReviewRow[];
}

export const useAppStore = create<AppState>((set) => ({
  dataVersion: 0,
  markDataChanged: () =>
    set((state) => ({ dataVersion: state.dataVersion + 1 })),
  recipeServingSession: null,
  recipeServingResult: null,
  beginRecipeServing: (session) =>
    set({ recipeServingSession: session, recipeServingResult: null }),
  finishRecipeServing: (key, result) =>
    set({
      recipeServingSession: null,
      recipeServingResult: { key, ...result },
    }),
  clearRecipeServingResult: (key) =>
    set((state) =>
      state.recipeServingResult?.key === key
        ? { recipeServingResult: null }
        : state,
    ),
  mixedMealDraft: null,
  setMixedMealDraft: (draft) => set({ mixedMealDraft: draft }),
  clearMixedMealDraft: () => set({ mixedMealDraft: null }),
  mixedMealManualResult: null,
  setMixedMealManualResult: (food) => set({ mixedMealManualResult: food }),
  clearMixedMealManualResult: () => set({ mixedMealManualResult: null }),
  photoLogSession: null,
  beginPhotoLogSession: (session) => set({ photoLogSession: session }),
  setPhotoLogImage: (image) =>
    set((state) =>
      state.photoLogSession === null
        ? state
        : { photoLogSession: { ...state.photoLogSession, ...image } },
    ),
  setPhotoLogRows: (rows) =>
    set((state) =>
      state.photoLogSession === null
        ? state
        : { photoLogSession: { ...state.photoLogSession, rows } },
    ),
  updatePhotoLogRow: (id, update) =>
    set((state) => {
      if (state.photoLogSession === null) return state;
      return {
        photoLogSession: {
          ...state.photoLogSession,
          rows: state.photoLogSession.rows.map((row) =>
            row.id === id ? update(row) : row,
          ),
        },
      };
    }),
  clearPhotoLogSession: () => set({ photoLogSession: null }),
}));

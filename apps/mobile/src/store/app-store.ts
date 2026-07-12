import { create } from 'zustand';
import type {
  RecipeEditorIngredientDraft,
  RecipeServingOperation,
  RecipeServingResult,
} from '@/lib/recipe-ui';

export interface RecipeServingSession {
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
}));

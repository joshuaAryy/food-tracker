import { describe, expect, it } from 'vitest';
import { useAppStore } from './app-store';

describe('application user-state reset', () => {
  it('clears recipe, mixed-meal, and photo sessions while preserving global versioning', () => {
    useAppStore.setState({
      recipeServingSession: {
        context: 'recipe',
        key: 'recipe-1',
        operation: 'add',
        ingredientIndex: 0,
        draft: {} as never,
      },
      mixedMealDraft: {} as never,
      mixedMealManualResult: {} as never,
      photoLogSession: {} as never,
    });
    const before = useAppStore.getState().dataVersion;

    useAppStore.getState().resetUserData();

    const state = useAppStore.getState();
    expect(state.recipeServingSession).toBeNull();
    expect(state.recipeServingResult).toBeNull();
    expect(state.mixedMealDraft).toBeNull();
    expect(state.mixedMealManualResult).toBeNull();
    expect(state.photoLogSession).toBeNull();
    expect(state.dataVersion).toBe(before + 1);
  });
});

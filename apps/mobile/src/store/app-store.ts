import { create } from 'zustand';

interface AppState {
  mockMode: 'simple' | 'complex';
  setMockMode: (mode: AppState['mockMode']) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mockMode: 'simple',
  setMockMode: (mockMode) => set({ mockMode }),
}));

import { create } from 'zustand';

interface AppState {
  dataVersion: number;
  markDataChanged: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  dataVersion: 0,
  markDataChanged: () =>
    set((state) => ({ dataVersion: state.dataVersion + 1 })),
}));

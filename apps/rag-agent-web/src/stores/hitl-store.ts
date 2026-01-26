import { create } from 'zustand';
import type { HITLRequest } from '@/types';

interface HITLState {
  pendingRequest: HITLRequest | null;
  history: Array<HITLRequest & { approved: boolean; respondedAt: Date }>;

  // Actions
  setPendingRequest: (request: HITLRequest | null) => void;
  addToHistory: (request: HITLRequest, approved: boolean) => void;
  clearHistory: () => void;
}

export const useHITLStore = create<HITLState>((set) => ({
  pendingRequest: null,
  history: [],

  setPendingRequest: (request) => {
    set({ pendingRequest: request });
  },

  addToHistory: (request, approved) => {
    set((state) => ({
      history: [
        { ...request, approved, respondedAt: new Date() },
        ...state.history.slice(0, 49), // Keep only 50 most recent
      ],
      pendingRequest: null,
    }));
  },

  clearHistory: () => {
    set({ history: [] });
  },
}));

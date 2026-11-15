import { create } from 'zustand';

import type { Row } from '../db/db';

export type SyncState = {
  running: boolean;
  /** True only while the very first index is being built. */
  firstRun: boolean;
  done: number;
  total: number;
};

export type Toast = { id: number; text: string; undo?: () => Promise<void> };

/** What the grid / one-by-one screens are working on. */
export type Session = { title: string; mode: 'todo' | 'reviewed'; rows: Row[] };

type LibraryState = {
  /** Bumped after any change to the database, so queries re-run. */
  version: number;
  /** Bumped only after a real delete, so the Library grid reloads. */
  libraryVersion: number;
  sync: SyncState;
  toast: Toast | null;
  session: Session | null;

  bump: () => void;
  bumpLibrary: () => void;
  setSync: (patch: Partial<SyncState>) => void;
  showToast: (text: string, undo?: () => Promise<void>) => void;
  hideToast: () => void;
  setSession: (session: Session | null) => void;
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useLibrary = create<LibraryState>()((set) => ({
  version: 0,
  libraryVersion: 0,
  sync: { running: false, firstRun: false, done: 0, total: 0 },
  toast: null,
  session: null,

  bump: () => set((s) => ({ version: s.version + 1 })),
  bumpLibrary: () => set((s) => ({ version: s.version + 1, libraryVersion: s.libraryVersion + 1 })),
  setSync: (patch) => set((s) => ({ sync: { ...s.sync, ...patch } })),
  showToast: (text, undo) => {
    clearTimeout(toastTimer);
    set({ toast: { id: Date.now(), text, undo } });
    toastTimer = setTimeout(() => set({ toast: null }), 5000);
  },
  hideToast: () => {
    clearTimeout(toastTimer);
    set({ toast: null });
  },
  setSession: (session) => set({ session }),
}));

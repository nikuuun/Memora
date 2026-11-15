import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Asset } from 'expo-media-library/legacy';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * The trash queue: every way of deleting (swipe, type filter, date filter,
 * Library grid) only ADDS photos here. Nothing leaves the phone until the
 * user confirms on the Review screen, which sends one batch delete, so iOS
 * shows one system popup instead of one per photo.
 */

export type QueuedPhoto = {
  id: string;
  uri: string;
  mediaType: string;
  creationTime: number;
};

type Action = { type: 'trash' | 'keep'; photos: QueuedPhoto[] };

type TrashState = {
  queue: Record<string, QueuedPhoto>;
  /** Photos the user swiped right on, so the swipe deck doesn't show them again. */
  kept: Record<string, true>;
  /** Undo history for this session (not persisted). */
  history: Action[];
  /** Bumped after a real delete so photo lists reload. */
  libraryVersion: number;

  trash: (photos: QueuedPhoto[]) => void;
  keep: (photo: QueuedPhoto) => void;
  restore: (ids: string[]) => void;
  undo: () => Action | null;
  markDeleted: (ids: string[]) => void;
  resetKept: () => void;
};

const MAX_HISTORY = 100;

export const toQueued = (a: Asset): QueuedPhoto => ({
  id: a.id,
  uri: a.uri,
  mediaType: a.mediaType,
  creationTime: a.creationTime,
});

export const useTrash = create<TrashState>()(
  persist(
    (set, get) => ({
      queue: {},
      kept: {},
      history: [],
      libraryVersion: 0,

      trash: (photos) =>
        set((s) => {
          const queue = { ...s.queue };
          for (const p of photos) queue[p.id] = p;
          return {
            queue,
            history: [...s.history, { type: 'trash' as const, photos }].slice(-MAX_HISTORY),
          };
        }),

      keep: (photo) =>
        set((s) => ({
          kept: { ...s.kept, [photo.id]: true },
          history: [...s.history, { type: 'keep' as const, photos: [photo] }].slice(-MAX_HISTORY),
        })),

      restore: (ids) =>
        set((s) => {
          const queue = { ...s.queue };
          for (const id of ids) delete queue[id];
          return { queue };
        }),

      undo: () => {
        const last = get().history.at(-1);
        if (!last) return null;
        set((s) => {
          const queue = { ...s.queue };
          const kept = { ...s.kept };
          for (const p of last.photos) {
            if (last.type === 'trash') delete queue[p.id];
            else delete kept[p.id];
          }
          return { queue, kept, history: s.history.slice(0, -1) };
        });
        return last;
      },

      markDeleted: (ids) =>
        set((s) => {
          const queue = { ...s.queue };
          const kept = { ...s.kept };
          for (const id of ids) {
            delete queue[id];
            delete kept[id];
          }
          return { queue, kept, history: [], libraryVersion: s.libraryVersion + 1 };
        }),

      resetKept: () => set({ kept: {}, history: [] }),
    }),
    {
      name: 'memora-trash',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ queue: s.queue, kept: s.kept }),
    },
  ),
);

export const useTrashCount = () => useTrash((s) => Object.keys(s.queue).length);

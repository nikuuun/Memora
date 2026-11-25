import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Crop } from '../digicam/look';

export type Flash = 'off' | 'auto' | 'on';
export type Timer = 0 | 3 | 10;
export type Ratio = '4:3' | '1:1' | '16:9';

/** Portrait height ÷ width for each frame shape. */
export const RATIO_HEIGHT: Record<Ratio, number> = { '4:3': 4 / 3, '1:1': 1, '16:9': 16 / 9 };
/** The viewfinder shape as a crop of the (portrait) photo. */
export const RATIO_CROP: Record<Ratio, Crop> = { '4:3': '3:4', '1:1': '1:1', '16:9': '9:16' };

type CameraSettings = {
  flash: Flash;
  timer: Timer;
  grid: boolean;
  ratio: Ratio;
  dateStamp: boolean;
  /** Digicam camera id (src/digicam/look.ts). */
  camera: string;
  shutterSound: boolean;
  facing: 'back' | 'front';
  set: (patch: Partial<Omit<CameraSettings, 'set'>>) => void;
};

/** Camera settings, remembered between launches. */
export const useCameraSettings = create<CameraSettings>()(
  persist(
    (set) => ({
      flash: 'off',
      timer: 0,
      grid: false,
      ratio: '4:3',
      dateStamp: true,
      camera: 'daily',
      shutterSound: true,
      facing: 'back',
      set: (patch) => set(patch),
    }),
    {
      name: 'memora-camera',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ set: _set, ...rest }) => rest,
      // v1 stored a colour "look"; v2 picks a camera instead.
      migrate: (old) => ({ ...(old as object), camera: 'daily' }) as CameraSettings,
    },
  ),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ViewStyle } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Flash = 'off' | 'auto' | 'on';
export type Timer = 0 | 3 | 10;
export type Ratio = '4:3' | '1:1' | '16:9';

/** Portrait height ÷ width for each frame shape. */
export const RATIO_HEIGHT: Record<Ratio, number> = { '4:3': 4 / 3, '1:1': 1, '16:9': 16 / 9 };

type Layer = { color: string; opacity?: number; blend?: ViewStyle['mixBlendMode'] };
export type Look = { id: string; name: string; swatch: string; layers: Layer[] };

/**
 * Film-style looks, made from colour layers over the photo. The same layers
 * tint the live preview and are baked into the saved photo.
 */
export const LOOKS: Look[] = [
  { id: 'natural', name: 'Natural', swatch: '#D9D4C7', layers: [] },
  {
    id: 'gold',
    name: 'Gold',
    swatch: '#E7B25F',
    layers: [
      { color: '#FF9A3C', opacity: 0.28, blend: 'soft-light' },
      { color: '#FFE2B0', opacity: 0.08 },
    ],
  },
  {
    id: 'faded',
    name: 'Faded',
    swatch: '#D8CDBB',
    layers: [
      { color: '#F3E8D6', opacity: 0.2 },
      { color: '#6B4E3D', opacity: 0.12, blend: 'multiply' },
    ],
  },
  { id: 'blue', name: 'Blue hour', swatch: '#7F9BD0', layers: [{ color: '#2F6BFF', opacity: 0.26, blend: 'soft-light' }] },
  {
    id: 'y2k',
    name: 'Y2K',
    swatch: '#E7A1C7',
    layers: [
      { color: '#FF5FAE', opacity: 0.16, blend: 'soft-light' },
      { color: '#5EE7FF', opacity: 0.08, blend: 'screen' },
    ],
  },
  { id: 'mono', name: 'Mono', swatch: '#8A8A85', layers: [{ color: '#000', blend: 'saturation' }] },
  {
    id: 'sepia',
    name: 'Sepia',
    swatch: '#A47E57',
    layers: [
      { color: '#000', blend: 'saturation' },
      { color: '#A0703C', opacity: 0.6, blend: 'color' },
    ],
  },
];

export const lookById = (id: string) => LOOKS.find((l) => l.id === id) ?? LOOKS[0];

type CameraSettings = {
  flash: Flash;
  timer: Timer;
  grid: boolean;
  ratio: Ratio;
  dateStamp: boolean;
  look: string;
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
      look: 'natural',
      shutterSound: true,
      facing: 'back',
      set: (patch) => set(patch),
    }),
    {
      name: 'memora-camera',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);

/** Classic digicam date stamp: ’26 11 24. */
export function stampText(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `’${p(d.getFullYear() % 100)} ${p(d.getMonth() + 1)} ${p(d.getDate())}`;
}

import { Platform, StyleSheet, View } from 'react-native';

import { Text } from '../components/Text';
import type { Look } from './settings';

/** The look's colour layers, filling the parent (which should set `isolation: 'isolate'`). */
export function LookLayers({ look }: { look: Look }) {
  return (
    <>
      {look.layers.map((l, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: l.color, opacity: l.opacity ?? 1, mixBlendMode: l.blend ?? 'normal' }]}
        />
      ))}
    </>
  );
}

const MONO = Platform.select({ ios: 'Menlo-Bold', default: 'monospace' });

/** Orange digital date in the bottom-right corner, sized to the frame width. */
export function DateStamp({ width, text }: { width: number; text: string }) {
  const size = Math.max(10, width * 0.045);
  return (
    <Text
      pointerEvents="none"
      style={{
        position: 'absolute',
        right: width * 0.05,
        bottom: width * 0.045,
        fontFamily: MONO,
        fontSize: size,
        letterSpacing: size * 0.08,
        color: '#FF9A3C',
        textShadowColor: 'rgba(255,110,20,0.75)',
        textShadowRadius: size * 0.35,
        textShadowOffset: { width: 0, height: 0 },
      }}
    >
      {text}
    </Text>
  );
}

/** Rule-of-thirds guides. */
export function GridLines() {
  const line = { position: 'absolute' as const, backgroundColor: 'rgba(255,255,255,0.45)' };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[line, { left: '33.33%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth }]} />
      <View style={[line, { left: '66.66%', top: 0, bottom: 0, width: StyleSheet.hairlineWidth }]} />
      <View style={[line, { top: '33.33%', left: 0, right: 0, height: StyleSheet.hairlineWidth }]} />
      <View style={[line, { top: '66.66%', left: 0, right: 0, height: StyleSheet.hairlineWidth }]} />
    </View>
  );
}

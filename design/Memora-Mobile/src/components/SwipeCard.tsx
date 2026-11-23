import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { Asset } from 'expo-media-library';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius } from '../theme';

export type SwipeDirection = 'trash' | 'keep';

type Props = {
  asset: Asset;
  isTop: boolean;
  onSwiped: (asset: Asset, direction: SwipeDirection) => void;
};

/** Tuning knobs for how the swipe feels. */
const DISTANCE_THRESHOLD = 0.28; // fraction of screen width
const VELOCITY_THRESHOLD = 900; // px/s: a quick flick counts even if short
const FLY_OUT_MS = 180;

/**
 * One card. Each card owns its own animation values, so when it flies off and
 * the parent removes it, the next card starts fresh at the centre (no flicker).
 * Left = trash, right = keep.
 */
export function SwipeCard({ asset, isTop, onSwiped }: Props) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY * 0.25;
    })
    .onEnd((e) => {
      const farEnough = Math.abs(e.translationX) > width * DISTANCE_THRESHOLD;
      const fastEnough = Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
      if (!farEnough && !fastEnough) {
        x.value = withSpring(0, { damping: 18, stiffness: 220 });
        y.value = withSpring(0, { damping: 18, stiffness: 220 });
        return;
      }
      const goingRight = farEnough ? e.translationX > 0 : e.velocityX > 0;
      x.value = withTiming(goingRight ? width * 1.5 : -width * 1.5, { duration: FLY_OUT_MS }, (done) => {
        if (done) runOnJS(onSwiped)(asset, goingRight ? 'keep' : 'trash');
      });
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, width], [-12, 12])}deg` },
      { scale: isTop ? 1 : 0.95 },
    ],
  }));

  const trashLabel = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-width * 0.25, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const keepLabel = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, width * 0.25], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.card, cardStyle]}>
        <Image source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={asset.id} />
        {asset.mediaType === 'video' && (
          <View style={styles.videoBadge}>
            <Ionicons name="videocam" size={14} color="#fff" />
          </View>
        )}
        <Animated.View style={[styles.label, styles.labelLeft, trashLabel]}>
          <Text style={[styles.labelText, { color: colors.danger }]}>Delete</Text>
        </Animated.View>
        <Animated.View style={[styles.label, styles.labelRight, keepLabel]}>
          <Text style={[styles.labelText, { color: colors.keep }]}>Keep</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  videoBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: colors.overlay,
    borderRadius: 999,
    padding: 6,
  },
  label: {
    position: 'absolute',
    top: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  labelLeft: { right: 20 },
  labelRight: { left: 20 },
  labelText: { fontSize: 20, fontWeight: '700' },
});

import { Image, type ImageSource } from 'expo-image';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

type Props = {
  source: ImageSource;
  width: number;
  height: number;
  /** Told when the photo goes from fitted to zoomed in, and back. */
  onZoomChange?: (zoomed: boolean) => void;
  /** A single tap, e.g. to show or hide the controls. */
  onTap?: () => void;
};

/**
 * A whole photo, fitted to the screen. Pinch or double-tap to zoom, drag to look
 * around while zoomed. When not zoomed, drags pass through so the pager can swipe.
 */
export function ZoomableImage({ source, width, height, onZoomChange, onTap }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const report = (zoomed: boolean) => onZoomChange?.(zoomed);
  const tap = () => onTap?.();

  const clamp = (v: number, s: number, size: number) => {
    'worklet';
    const max = (size * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, v));
  };

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    x.value = withTiming(0);
    y.value = withTiming(0);
    savedScale.value = 1;
    savedX.value = 0;
    savedY.value = 0;
    runOnJS(report)(false);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(0.8, savedScale.value * e.scale));
      x.value = clamp(savedX.value, scale.value, width);
      y.value = clamp(savedY.value, scale.value, height);
    })
    .onEnd(() => {
      if (scale.value <= 1.05) {
        reset();
        return;
      }
      savedScale.value = scale.value;
      savedX.value = x.value;
      savedY.value = y.value;
      runOnJS(report)(true);
    });

  // Only takes over a drag while zoomed in; otherwise the pager gets it.
  const pan = Gesture.Pan()
    .manualActivation(true)
    .averageTouches(true)
    .onTouchesMove((_e, state) => {
      if (scale.value > 1.01) state.activate();
      else state.fail();
    })
    .onUpdate((e) => {
      x.value = clamp(savedX.value + e.translationX, scale.value, width);
      y.value = clamp(savedY.value + e.translationY, scale.value, height);
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e, success) => {
      if (!success) return;
      if (scale.value > 1.01) {
        reset();
        return;
      }
      // Zoom towards the spot that was tapped.
      const s = DOUBLE_TAP_SCALE;
      const nx = clamp((width / 2 - e.x) * (s - 1), s, width);
      const ny = clamp((height / 2 - e.y) * (s - 1), s, height);
      scale.value = withTiming(s);
      x.value = withTiming(nx);
      y.value = withTiming(ny);
      savedScale.value = s;
      savedX.value = nx;
      savedY.value = ny;
      runOnJS(report)(true);
    });

  const singleTap = Gesture.Tap().onEnd((_e, success) => {
    if (success) runOnJS(tap)();
  });

  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, style]}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" transition={120} />
      </Animated.View>
    </GestureDetector>
  );
}

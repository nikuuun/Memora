import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { DateStamp, GridLines, LookLayers } from '../../src/camera/Overlays';
import {
  type Flash,
  type Look,
  LOOKS,
  lookById,
  RATIO_HEIGHT,
  type Ratio,
  stampText,
  type Timer,
  useCameraSettings,
} from '../../src/camera/settings';
import { Text } from '../../src/components/Text';
import { saveToMemora } from '../../src/media/save';
import { colors, fonts, radius } from '../../src/theme';

const ACTIVE = '#FF9A3C';
const FLASHES: Flash[] = ['off', 'auto', 'on'];
const TIMERS: Timer[] = [0, 3, 10];
const RATIOS: Ratio[] = ['4:3', '1:1', '16:9'];
const next = <T,>(list: T[], v: T) => list[(list.indexOf(v) + 1) % list.length];

/** Longest side of a saved photo that has a look, frame or date stamp baked in. */
const MAX_OUTPUT = 4032;

/** A photo waiting to have its look, frame and date drawn in before saving. */
type Job = { uri: string; width: number; height: number; look: Look; stamp: string | null };

/** Digicam: film looks, date stamp, flash, timer, grid, frame shape. Saves to Photos. */
export default function CameraScreen() {
  const focused = useIsFocused();
  const [perm, request] = useCameraPermissions();

  if (!perm) return <View style={styles.black} />;
  if (!perm.granted) {
    return (
      <SafeAreaView style={[styles.black, styles.center]}>
        <Ionicons name="camera-outline" size={36} color="#fff" />
        <Text style={styles.permTitle}>Let Memora use the camera</Text>
        <Text style={styles.permBody}>Photos you take are saved to your library, in a Memora album.</Text>
        <Pressable style={styles.permBtn} onPress={() => (perm.canAskAgain ? request() : Linking.openSettings())}>
          <Text style={styles.permBtnText}>{perm.canAskAgain ? 'Allow camera' : 'Open Settings'}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
  // The camera only runs while this tab is on screen.
  return focused ? <Digicam /> : <View style={styles.black} />;
}

function Digicam() {
  const s = useCameraSettings();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const camera = useRef<CameraView>(null);
  const composer = useRef<ComponentRef<typeof View>>(null);
  const loaded = useRef<(() => void) | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashOpacity = useSharedValue(0);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

  const [ready, setReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const zoomStart = useSharedValue(0);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const look = lookById(s.look);
  // The viewfinder keeps the frame shape, shrinking if a tall frame wouldn't fit.
  const frameW = Math.min(screenW, (screenH * 0.62) / RATIO_HEIGHT[s.ratio]);
  const frameH = frameW * RATIO_HEIGHT[s.ratio];

  useEffect(() => () => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
  }, []);

  // iOS sends "camera ready" only once per camera view, and it can be missed,
  // so never wait on it for long: the shutter works after a moment regardless.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      zoomStart.value = zoom;
    })
    .onUpdate((e) => {
      setZoom(Math.min(1, Math.max(0, zoomStart.value + (e.scale - 1) * 0.12)));
    });

  const blink = () => {
    flashOpacity.set(withSequence(withTiming(1, { duration: 0 }), withTiming(0, { duration: 260 })));
  };

  /** Draws the look, frame shape and date into the photo, using the hidden composer view. */
  const compose = async (photo: { uri: string; width: number; height: number }) => {
    const h = RATIO_HEIGHT[s.ratio];
    // Crop to the frame shape from the middle of the photo, like the viewfinder shows.
    const fitsWidth = photo.height / photo.width >= h;
    const outW = Math.min(MAX_OUTPUT / h, fitsWidth ? photo.width : photo.height / h);
    const shown = new Promise<void>((resolve) => {
      loaded.current = resolve;
      setTimeout(resolve, 5000); // never hang if the image doesn't report back
    });
    // Laid out at full size (in points), so the capture is sharp rather than an upscaled preview.
    const w = outW / PixelRatio.get();
    setJob({ uri: photo.uri, width: w, height: w * h, look, stamp: s.dateStamp ? stampText() : null });
    await shown;
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const uri = await captureRef(composer, { format: 'jpg', quality: 0.92 });
    setJob(null);
    return uri;
  };

  const shoot = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      blink();
      const photo = await camera.current.takePictureAsync({ quality: 0.92, shutterSound: s.shutterSound });
      const plain = look.layers.length === 0 && !s.dateStamp && s.ratio === '4:3';
      const uri = plain ? photo.uri : await compose(photo);
      await saveToMemora(uri);
      setLast(uri);
      setToast('Saved to Photos');
    } catch (e) {
      setJob(null);
      Alert.alert('Couldn’t save the photo', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onShutter = () => {
    // Tapping again during the countdown cancels it.
    if (count != null) {
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      setCount(null);
      return;
    }
    if (!s.timer) return void shoot();
    let left: number = s.timer;
    setCount(left);
    countdownTimer.current = setInterval(() => {
      left -= 1;
      if (left > 0) return setCount(left);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      setCount(null);
      void shoot();
    }, 1000);
  };

  const flashIcon = s.flash === 'off' ? 'flash-off-outline' : 'flash-outline';

  return (
    <View style={styles.black}>
      {/* Hidden composer: draws the saved photo with its look and date. Covered by the UI below. */}
      {job ? (
        <View ref={composer} collapsable={false} style={[styles.composer, { width: job.width, height: job.height }]}>
          <Image
            source={{ uri: job.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onLoad={() => loaded.current?.()}
            onError={() => loaded.current?.()}
          />
          <LookLayers look={job.look} />
          {job.stamp ? <DateStamp width={job.width} text={job.stamp} /> : null}
        </View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.black]} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Settings bar */}
        <View style={styles.topBar}>
          <TopButton label={`Flash ${s.flash}`} onPress={() => s.set({ flash: next(FLASHES, s.flash) })}>
            <Ionicons name={flashIcon} size={22} color={s.flash !== 'off' ? ACTIVE : '#fff'} />
            {s.flash === 'auto' ? <Text style={[styles.badge, { color: ACTIVE }]}>A</Text> : null}
          </TopButton>
          <TopButton label={s.timer ? `Timer ${s.timer} seconds` : 'Timer off'} onPress={() => s.set({ timer: next(TIMERS, s.timer) })}>
            <Ionicons name="timer-outline" size={22} color={s.timer ? ACTIVE : '#fff'} />
            {s.timer ? <Text style={[styles.badge, { color: ACTIVE }]}>{s.timer}s</Text> : null}
          </TopButton>
          <TopButton label={`Frame ${s.ratio}`} onPress={() => s.set({ ratio: next(RATIOS, s.ratio) })}>
            <Text style={styles.ratio}>{s.ratio}</Text>
          </TopButton>
          <TopButton label={s.grid ? 'Grid on' : 'Grid off'} onPress={() => s.set({ grid: !s.grid })}>
            <Ionicons name="grid-outline" size={20} color={s.grid ? ACTIVE : '#fff'} />
          </TopButton>
          <TopButton label={s.dateStamp ? 'Date stamp on' : 'Date stamp off'} onPress={() => s.set({ dateStamp: !s.dateStamp })}>
            <Text style={[styles.dateBtn, s.dateStamp && { color: ACTIVE, borderColor: ACTIVE }]}>DATE</Text>
          </TopButton>
          <TopButton
            label={s.shutterSound ? 'Shutter sound on' : 'Shutter sound off'}
            onPress={() => s.set({ shutterSound: !s.shutterSound })}
          >
            <Ionicons name={s.shutterSound ? 'volume-high-outline' : 'volume-mute-outline'} size={22} color="#fff" />
          </TopButton>
        </View>

        {/* Viewfinder */}
        <View style={styles.finderArea}>
          <GestureDetector gesture={pinch}>
            <View style={[styles.finder, { width: frameW, height: frameH }]} collapsable={false}>
              <CameraView
                ref={camera}
                style={StyleSheet.absoluteFill}
                facing={s.facing}
                flash={s.flash}
                zoom={zoom}
                animateShutter={false}
                onCameraReady={() => setReady(true)}
                onMountError={(e) => setMountError(e.message)}
              />
              <LookLayers look={look} />
              {s.grid ? <GridLines /> : null}
              {s.dateStamp ? <DateStamp width={frameW} text={stampText()} /> : null}
              {count != null ? (
                <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
                  <Text style={styles.count}>{count}</Text>
                </View>
              ) : null}
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.blink, blinkStyle]} />
              {mountError ? (
                <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
                  <Text style={styles.mountError}>Camera couldn’t start: {mountError}</Text>
                </View>
              ) : !ready ? (
                <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </View>
          </GestureDetector>
          {zoom > 0.01 ? (
            <Pressable style={styles.zoomPill} onPress={() => setZoom(0)} accessibilityLabel="Reset zoom">
              <Text style={styles.zoomText}>Reset zoom</Text>
            </Pressable>
          ) : null}
          {toast ? (
            <View style={styles.toast} pointerEvents="none">
              <Ionicons name="checkmark-circle" size={16} color={colors.card} />
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          ) : null}
        </View>

        {/* Looks */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.looks}>
          {LOOKS.map((l) => {
            const on = l.id === look.id;
            return (
              <Pressable
                key={l.id}
                onPress={() => s.set({ look: l.id })}
                style={styles.look}
                accessibilityLabel={`${l.name} look`}
                accessibilityState={{ selected: on }}
              >
                <View style={[styles.swatch, { backgroundColor: l.swatch }, on && styles.swatchOn]} />
                <Text style={[styles.lookName, on && { color: '#fff' }]}>{l.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Shutter row */}
        <View style={styles.bottom}>
          <Pressable
            style={styles.thumb}
            disabled={!last}
            onPress={() => Linking.openURL(Platform.OS === 'ios' ? 'photos-redirect://' : 'content://media/internal/images/media')}
            accessibilityLabel="Open Photos"
          >
            {last ? <Image source={{ uri: last }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </Pressable>
          <Pressable
            style={[styles.shutter, busy && { opacity: 0.5 }]}
            onPress={onShutter}
            disabled={busy}
            accessibilityLabel={count != null ? 'Cancel timer' : 'Take photo'}
          >
            <View style={[styles.shutterInner, count != null && styles.shutterCancel]} />
          </Pressable>
          <Pressable
            style={styles.flip}
            onPress={() => {
              setZoom(0);
              s.set({ facing: s.facing === 'back' ? 'front' : 'back' });
            }}
            accessibilityLabel="Switch camera"
          >
            <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function TopButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={4} style={styles.topBtn}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  composer: { position: 'absolute', left: 0, top: 0, isolation: 'isolate', overflow: 'hidden' },
  permTitle: { fontFamily: fonts.serif, fontSize: 24, color: '#fff', marginTop: 14, textAlign: 'center' },
  permBody: { fontSize: 15, lineHeight: 22, color: colors.mutedOnDark, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 },
  permBtn: { marginTop: 20, height: 48, paddingHorizontal: 24, borderRadius: radius.lg, backgroundColor: '#fff', justifyContent: 'center' },
  permBtnText: { fontSize: 16, fontWeight: '600', color: colors.text },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 2 },
  topBtn: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  badge: { fontFamily: fonts.bold, fontSize: 10, marginLeft: 1 },
  ratio: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  dateBtn: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  finderArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  finder: { overflow: 'hidden', isolation: 'isolate', backgroundColor: '#111' },
  count: { fontFamily: fonts.bold, fontSize: 96, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 12 },
  blink: { backgroundColor: '#fff' },
  mountError: { fontSize: 14, color: '#fff', textAlign: 'center', paddingHorizontal: 24 },
  zoomPill: {
    position: 'absolute',
    bottom: 12,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
  },
  zoomText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  toast: {
    position: 'absolute',
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(37,37,31,0.85)',
  },
  toastText: { fontSize: 13, fontWeight: '600', color: colors.card },
  looks: { paddingHorizontal: 12, gap: 4, paddingVertical: 8 },
  look: { width: 64, alignItems: 'center', gap: 5, paddingVertical: 2 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: '#fff' },
  lookName: { fontSize: 11, fontWeight: '600', color: '#9A978C' },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 4,
    paddingBottom: 12,
  },
  thumb: { width: 48, height: 48, borderRadius: 10, overflow: 'hidden', backgroundColor: '#222', borderWidth: 1, borderColor: '#444' },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  shutterCancel: { width: 28, height: 28, borderRadius: 6, backgroundColor: ACTIVE },
  flip: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
});

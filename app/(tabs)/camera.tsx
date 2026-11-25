import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useIsFocused } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { DateStamp, GridLines, LookLayers } from '../../src/camera/Overlays';
import { type Flash, RATIO_CROP, RATIO_HEIGHT, type Ratio, type Timer, useCameraSettings } from '../../src/camera/settings';
import { Text } from '../../src/components/Text';
import { CAMERAS, cameraById, cameraSvg, defaultDevelop, previewLayers, stampLabel } from '../../src/digicam/look';
import { addShot, listShots } from '../../src/digicam/shots';
import { useDbQuery } from '../../src/library/useDbQuery';
import { colors, fonts, radius } from '../../src/theme';

const ACTIVE = '#FF9A3C';
const FLASHES: Flash[] = ['off', 'auto', 'on'];
const TIMERS: Timer[] = [0, 3, 10];
const RATIOS: Ratio[] = ['4:3', '1:1', '16:9'];
const next = <T,>(list: T[], v: T) => list[(list.indexOf(v) + 1) % list.length];

/** Drawn once: the camera-body pictures for the picker. */
const BODIES = Object.fromEntries(CAMERAS.map((c) => [c.id, cameraSvg(c.body)]));

/** Digicam: pick a camera, shoot, and the photo is developed with that camera's look. */
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
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashOpacity = useSharedValue(0);
  const blinkStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

  const [ready, setReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const zoomStart = useSharedValue(0);
  const [count, setCount] = useState<number | null>(null);
  const [developing, setDeveloping] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const latest = useDbQuery(() => listShots(1), []);

  const cam = cameraById(s.camera);
  const layers = useMemo(() => previewLayers(cam.recipe), [cam]);
  // The viewfinder keeps the frame shape, shrinking if a tall frame wouldn't fit.
  const frameW = Math.min(screenW, (screenH * 0.56) / RATIO_HEIGHT[s.ratio]);
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

  const shoot = async () => {
    if (!camera.current) return;
    flashOpacity.set(withSequence(withTiming(1, { duration: 0 }), withTiming(0, { duration: 260 })));
    let uri: string;
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.95, shutterSound: s.shutterSound });
      uri = photo.uri;
    } catch (e) {
      Alert.alert('Couldn’t take the photo', e instanceof Error ? e.message : 'Please try again.');
      return;
    }
    // Develop in the background so you can keep shooting.
    setDeveloping((n) => n + 1);
    try {
      await addShot(uri, defaultDevelop(cam.id, { stamp: s.dateStamp, crop: RATIO_CROP[s.ratio] }), 'camera');
      setToast('Saved to Photos');
    } catch (e) {
      Alert.alert('Couldn’t save the photo', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setDeveloping((n) => n - 1);
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
  const last = latest?.[0];

  return (
    <SafeAreaView style={styles.black} edges={['top']}>
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
            <LookLayers layers={layers} />
            {s.grid ? <GridLines /> : null}
            {s.dateStamp ? <DateStamp width={frameW} text={stampLabel(cam.stamp.style, new Date())} /> : null}
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
            <View style={styles.camTag} pointerEvents="none">
              <Text style={styles.camTagText}>{cam.name.toUpperCase()}</Text>
            </View>
          </View>
        </GestureDetector>
        {zoom > 0.01 ? (
          <Pressable style={styles.zoomPill} onPress={() => setZoom(0)} accessibilityLabel="Reset zoom">
            <Text style={styles.zoomText}>Reset zoom</Text>
          </Pressable>
        ) : null}
        {developing > 0 || toast ? (
          <View style={styles.toast} pointerEvents="none">
            {developing > 0 ? <ActivityIndicator size="small" color={colors.card} /> : <Ionicons name="checkmark-circle" size={16} color={colors.card} />}
            <Text style={styles.toastText}>{developing > 0 ? 'Developing…' : toast}</Text>
          </View>
        ) : null}
      </View>

      {/* Camera picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cams}>
        {CAMERAS.map((c) => {
          const on = c.id === cam.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => s.set({ camera: c.id })}
              style={[styles.cam, on && styles.camOn]}
              accessibilityLabel={`${c.name} camera. ${c.blurb}`}
              accessibilityState={{ selected: on }}
            >
              <SvgXml xml={BODIES[c.id]} width={60} height={42} />
              <Text style={[styles.camName, on && { color: '#fff' }]} numberOfLines={1}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Shutter row */}
      <View style={styles.bottom}>
        <Pressable style={styles.thumb} onPress={() => router.push('/roll')} accessibilityLabel="Open your Memora photos">
          {last ? (
            <Image source={{ uri: last.developedUri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={last.developedUri} />
          ) : (
            <Ionicons name="images-outline" size={20} color="#888" />
          )}
        </Pressable>
        <Pressable style={styles.shutter} onPress={onShutter} accessibilityLabel={count != null ? 'Cancel timer' : 'Take photo'}>
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
  camTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  camTagText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, color: '#fff' },
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
  cams: { paddingHorizontal: 10, gap: 6, paddingVertical: 8 },
  cam: { width: 76, alignItems: 'center', paddingVertical: 6, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent' },
  camOn: { borderColor: ACTIVE, backgroundColor: '#1A1A1A' },
  camName: { fontSize: 10.5, fontWeight: '600', color: '#9A978C', marginTop: 4 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 4,
    paddingBottom: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
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

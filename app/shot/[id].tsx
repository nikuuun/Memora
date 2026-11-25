import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Canvas, useImage } from '@shopify/react-native-skia';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';

import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Text } from '../../src/components/Text';
import { DevelopedPhoto } from '../../src/digicam/Developed';
import {
  type Adjust,
  CAMERAS,
  cameraById,
  cameraSvg,
  type Crop,
  type Develop,
  type FrameKind,
  layout,
  NO_ADJUST,
  STAMP_COLORS,
  type StampColor,
  stampLabel,
  type StampStyle,
  switchCamera,
} from '../../src/digicam/look';
import { getShot, removeShot, saveEdit, seedFor, type Shot } from '../../src/digicam/shots';
import { useDbQuery } from '../../src/library/useDbQuery';
import { colors, radius, space } from '../../src/theme';

const BODIES = Object.fromEntries(CAMERAS.map((c) => [c.id, cameraSvg(c.body)]));
type Tab = 'camera' | 'adjust' | 'date' | 'frame' | 'crop';
const TABS: { id: Tab; label: string }[] = [
  { id: 'camera', label: 'Camera' },
  { id: 'adjust', label: 'Adjust' },
  { id: 'date', label: 'Date' },
  { id: 'frame', label: 'Frame' },
  { id: 'crop', label: 'Crop' },
];

/** Edit one Memora photo: change camera, fine-tune the look, date, frame and crop. */
export default function ShotEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shot = useDbQuery(() => getShot(id), [id]);
  if (shot === undefined) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  if (!shot) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Photo not found" />
      </SafeAreaView>
    );
  }
  return <Editor key={shot.id} shot={shot} />;
}

function Editor({ shot }: { shot: Shot }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const image = useImage(shot.originalUri);
  const [develop, setDevelop] = useState<Develop>(shot.develop);
  const [history, setHistory] = useState<Develop[]>([]);
  const [tab, setTab] = useState<Tab>('camera');
  const [comparing, setComparing] = useState(false);
  const [saving, setSaving] = useState(false);

  const changed = JSON.stringify(develop) !== JSON.stringify(shot.develop);
  const takenAt = new Date(shot.created);
  const cam = cameraById(develop.camera);

  /** Records the current state for Undo, then applies a change. */
  const apply = (next: Develop) => {
    setHistory((h) => [...h.slice(-30), develop]);
    setDevelop(next);
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setDevelop(prev);
  };

  // Preview size: as wide as the screen allows, never taller than ~half of it.
  const maxW = screenW - space.lg * 2;
  const maxH = screenH * 0.47;
  let previewW = maxW;
  if (image) {
    const L = layout(image.width(), image.height(), develop, maxW);
    if (L.height > maxH) previewW = (maxW * maxH) / L.height;
  }
  const L = image ? layout(image.width(), image.height(), develop, previewW) : null;
  const shown: Develop = comparing ? { ...develop, intensity: 0, adjust: { ...NO_ADJUST }, stamp: { ...develop.stamp, on: false } } : develop;

  const save = async () => {
    setSaving(true);
    try {
      await saveEdit(shot, develop);
      setHistory([]);
      Alert.alert('Saved to Photos', 'A new copy is in your library and the Memora album.');
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Remove from Memora?', 'It leaves your Memora photos. Copies already saved in Photos stay there.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        onPress: async () => {
          await removeShot(shot.id);
          router.back();
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title={cam.name}
        subtitle={takenAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        right={
          <View style={styles.headerRight}>
            <Pressable onPress={undo} disabled={!history.length} style={styles.iconBtn} accessibilityLabel="Undo">
              <Ionicons name="arrow-undo-outline" size={22} color={history.length ? colors.text : colors.line} />
            </Pressable>
            <Pressable onPress={remove} style={styles.iconBtn} accessibilityLabel="Remove from Memora">
              <Ionicons name="remove-circle-outline" size={22} color={colors.text} />
            </Pressable>
          </View>
        }
      />

      {/* Preview: hold to see the original */}
      <Pressable
        style={[styles.stage, { height: maxH + space.md }]}
        onPressIn={() => setComparing(true)}
        onPressOut={() => setComparing(false)}
        accessibilityLabel="Photo preview. Press and hold to see the original."
      >
        {image && L ? (
          <Canvas style={{ width: L.width, height: L.height }}>
            <DevelopedPhoto image={image} develop={shown} takenAt={takenAt} width={L.width} seed={seedFor(shot.created)} />
          </Canvas>
        ) : (
          <ActivityIndicator />
        )}
        <Text style={styles.compare}>{comparing ? 'Original' : 'Hold to compare'}</Text>
      </Pressable>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={styles.tab} accessibilityState={{ selected: tab === t.id }}>
            <Text style={[styles.tabText, tab === t.id && styles.tabOn]}>{t.label}</Text>
            {tab === t.id ? <View style={styles.tabLine} /> : null}
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.panel}>
        {tab === 'camera' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CAMERAS.map((c) => {
              const on = c.id === develop.camera;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => !on && apply(switchCamera(develop, c.id))}
                  style={[styles.camCard, on && styles.camCardOn]}
                  accessibilityLabel={`${c.name}. ${c.blurb}`}
                  accessibilityState={{ selected: on }}
                >
                  <SvgXml xml={BODIES[c.id]} width={70} height={49} />
                  <Text style={styles.camName} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        {tab === 'camera' ? <Text style={styles.blurb}>{cam.blurb}</Text> : null}

        {tab === 'adjust' ? (
          <View style={{ gap: 4 }}>
            <SliderRow label="Intensity" value={develop.intensity} min={0} max={1} onStart={() => apply(develop)} onChange={(v) => setDevelop((d) => ({ ...d, intensity: v }))} />
            {(
              [
                ['exposure', 'Exposure', -1],
                ['contrast', 'Contrast', -1],
                ['saturation', 'Saturation', -1],
                ['warmth', 'Warmth', -1],
                ['grain', 'Grain', 0],
                ['glow', 'Glow', 0],
                ['vignette', 'Vignette', 0],
              ] as [keyof Adjust, string, number][]
            ).map(([key, label, min]) => (
              <SliderRow
                key={key}
                label={label}
                value={develop.adjust[key]}
                min={min}
                max={1}
                onStart={() => apply(develop)}
                onChange={(v) => setDevelop((d) => ({ ...d, adjust: { ...d.adjust, [key]: v } }))}
              />
            ))}
            <Pressable
              style={styles.resetBtn}
              onPress={() => apply({ ...develop, intensity: 1, adjust: { ...NO_ADJUST } })}
              accessibilityLabel="Reset adjustments"
            >
              <Text style={styles.resetText}>Reset to {cam.name}</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === 'date' ? (
          <View style={{ gap: space.md }}>
            <View style={styles.switchRow}>
              <Text style={styles.rowLabel}>Date stamp</Text>
              <Switch value={develop.stamp.on} onValueChange={(on) => apply({ ...develop, stamp: { ...develop.stamp, on } })} />
            </View>
            <Options<StampStyle>
              value={develop.stamp.style}
              options={(['classic', 'full', 'short'] as StampStyle[]).map((v) => ({ value: v, label: stampLabel(v, takenAt) }))}
              onChange={(style) => apply({ ...develop, stamp: { ...develop.stamp, style, on: true } })}
            />
            <View style={styles.swatches}>
              {(Object.keys(STAMP_COLORS) as StampColor[]).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => apply({ ...develop, stamp: { ...develop.stamp, color: c, on: true } })}
                  style={[styles.swatch, { backgroundColor: STAMP_COLORS[c].fill }, develop.stamp.color === c && styles.swatchOn]}
                  accessibilityLabel={`${c} date colour`}
                />
              ))}
            </View>
            <Options<'br' | 'bl'>
              value={develop.stamp.pos}
              options={[
                { value: 'bl', label: 'Bottom left' },
                { value: 'br', label: 'Bottom right' },
              ]}
              onChange={(pos) => apply({ ...develop, stamp: { ...develop.stamp, pos, on: true } })}
            />
          </View>
        ) : null}

        {tab === 'frame' ? (
          <Options<FrameKind>
            value={develop.frame}
            options={[
              { value: 'none', label: 'None' },
              { value: 'print', label: 'Print' },
              { value: 'instant', label: 'Instant' },
              { value: 'film', label: 'Film' },
            ]}
            onChange={(frame) => apply({ ...develop, frame })}
          />
        ) : null}

        {tab === 'crop' ? (
          <Options<Crop>
            value={develop.crop}
            options={(['original', '3:4', '4:5', '1:1', '9:16', '4:3'] as Crop[]).map((v) => ({ value: v, label: v === 'original' ? 'Original' : v }))}
            onChange={(crop) => apply({ ...develop, crop })}
          />
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.btn, styles.secondary, !changed && styles.disabled]} disabled={!changed} onPress={() => apply(shot.develop)}>
          <Text style={styles.secondaryText}>Revert</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.primary, saving && styles.disabled]} disabled={saving} onPress={save}>
          {saving ? <ActivityIndicator color={colors.card} /> : <Ionicons name="download-outline" size={18} color={colors.card} />}
          <Text style={styles.primaryText}>Save to Photos</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SliderRow(props: { label: string; value: number; min: number; max: number; onStart: () => void; onChange: (v: number) => void }) {
  const shown = Math.round(props.value * 100);
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHead}>
        <Text style={styles.rowLabel}>{props.label}</Text>
        <Text style={styles.sliderValue}>{props.min < 0 && shown > 0 ? `+${shown}` : shown}</Text>
      </View>
      <Slider
        value={props.value}
        minimumValue={props.min}
        maximumValue={props.max}
        onSlidingStart={props.onStart}
        onValueChange={props.onChange}
        minimumTrackTintColor={colors.text}
        maximumTrackTintColor={colors.line}
        accessibilityLabel={props.label}
      />
    </View>
  );
}

function Options<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.options}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.option, value === o.value && styles.optionOn]}
          accessibilityState={{ selected: value === o.value }}
        >
          <Text style={[styles.optionText, value === o.value && styles.optionTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  headerRight: { flexDirection: 'row' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stage: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  compare: { fontSize: 11, color: colors.muted, marginTop: 6 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 8 },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  tabOn: { color: colors.text },
  tabLine: { position: 'absolute', bottom: -1, height: 2, left: 12, right: 12, backgroundColor: colors.text },
  panel: { padding: space.lg, gap: space.sm },
  camCard: {
    width: 88,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.card,
  },
  camCardOn: { borderColor: colors.text },
  camName: { fontSize: 11, fontWeight: '600', color: colors.text, marginTop: 4 },
  blurb: { fontSize: 13, color: colors.muted, marginTop: 4 },
  sliderRow: { paddingVertical: 2 },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderValue: { fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
  rowLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  resetBtn: { alignSelf: 'flex-start', height: 44, justifyContent: 'center' },
  resetText: { fontSize: 14, fontWeight: '600', color: colors.clay },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  swatches: { flexDirection: 'row', gap: 12 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.text },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  optionOn: { backgroundColor: colors.text },
  optionText: { fontSize: 14, fontWeight: '600', color: colors.text },
  optionTextOn: { color: colors.card },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: space.lg, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  btn: { height: 50, borderRadius: radius.lg, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 2, backgroundColor: colors.text },
  primaryText: { color: colors.card, fontSize: 15, fontWeight: '600' },
  secondary: { flex: 1, backgroundColor: colors.surface },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});

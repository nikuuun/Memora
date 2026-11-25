import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { PhotoTile } from '../../src/components/PhotoTile';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Text } from '../../src/components/Text';
import { type Photos, templateById, TemplateCanvas, type Texts } from '../../src/create/templates';
import { saveToMemora } from '../../src/media/save';
import { PermissionGate } from '../../src/photos/PermissionGate';
import { fetchPage } from '../../src/photos/query';
import { usePhotos } from '../../src/photos/usePhotos';
import { colors, radius, space } from '../../src/theme';

/** Saved images are this many pixels wide. */
const OUTPUT_WIDTH = 1440;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Fill a template with photos and captions, then save it to Photos as one image. */
export default function TemplateEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const template = templateById(id);
  const [photos, setPhotos] = useState<Photos>([]);
  const [texts, setTexts] = useState<Texts>(() => ({ ...template?.texts }));
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState<'fill' | 'save' | null>(null);
  const [saving, setSaving] = useState(false); // draws the hidden full-size copy
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const canvas = useRef<ComponentRef<typeof View>>(null);
  const loads = useRef<{ left: number; done?: () => void }>({ left: 0 });

  if (!template) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Template not found" />
      </SafeAreaView>
    );
  }

  const filled = photos.slice(0, template.slots).filter(Boolean).length;
  // Fit the whole canvas on screen: as wide as possible, but never taller than the space.
  const width = area ? Math.min(area.w, (area.h * 300) / template.height) : 0;

  const setPhoto = (i: number, uri: string | undefined) =>
    setPhotos((prev) => {
      const next = [...prev];
      next[i] = uri;
      return next;
    });

  const onSlot = (i: number) => {
    Keyboard.dismiss();
    if (!photos[i]) return setPicking(i);
    Alert.alert(`Photo ${i + 1}`, undefined, [
      { text: 'Change photo', onPress: () => setPicking(i) },
      { text: 'Remove from template', onPress: () => setPhoto(i, undefined) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /** Puts your newest photos into the empty slots. */
  const fillRecent = async () => {
    setBusy('fill');
    try {
      const used = new Set(photos.filter(Boolean));
      const page = await fetchPage();
      const fresh = page.assets.filter((a) => a.mediaType === 'photo' && !used.has(a.uri)).map((a) => a.uri);
      setPhotos((prev) => {
        const next = [...prev];
        for (let i = 0; i < template.slots; i++) if (!next[i]) next[i] = fresh.shift();
        return next;
      });
    } catch {
      Alert.alert('Couldn’t load your photos', 'Allow Memora to see your photos in Settings.');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const doSave = async () => {
      Keyboard.dismiss();
      setBusy('save');
      try {
        // Render a full-size copy off to the side and wait for its photos, so the
        // saved image is sharp rather than an upscaled screenshot.
        const allLoaded = new Promise<void>((resolve) => {
          loads.current = { left: filled, done: resolve };
          if (!filled) resolve();
          setTimeout(resolve, 5000); // never hang on a photo that won't load
        });
        setSaving(true);
        await allLoaded;
        await nextFrame();
        const uri = await captureRef(canvas, { format: 'jpg', quality: 0.92 });
        await saveToMemora(uri);
        Alert.alert('Saved to Photos', 'Find it in your library and the Memora album.');
      } catch (e) {
        Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setSaving(false);
        setBusy(null);
      }
    };
    if (filled < template.slots) {
      Alert.alert('Some spots are empty', 'Empty spots are saved as colour blocks.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Save anyway', onPress: () => void doSave() },
      ]);
    } else {
      await doSave();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {saving ? (
        <View ref={canvas} collapsable={false} style={styles.hidden}>
          <TemplateCanvas
            template={template}
            width={OUTPUT_WIDTH / PixelRatio.get()}
            photos={photos}
            texts={texts}
            onImageLoad={() => {
              loads.current.left -= 1;
              if (loads.current.left <= 0) loads.current.done?.();
            }}
          />
        </View>
      ) : null}
      {/* Covers the hidden copy. */}
      <View style={[StyleSheet.absoluteFill, styles.safe]} />
      <ScreenHeader
        title={template.name}
        subtitle={`${filled} of ${template.slots} photos`}
        right={
          filled ? (
            <Pressable onPress={() => setPhotos([])} hitSlop={8} style={styles.headerBtn} accessibilityLabel="Clear all photos">
              <Text style={styles.headerBtnText}>Clear</Text>
            </Pressable>
          ) : null
        }
      />
      {/* Scrolls only when the keyboard is up, so captions low on the canvas stay reachable. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.stage}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          if (!area) setArea({ w: w - space.lg * 2, h: h - space.lg * 2 });
        }}
      >
        <Pressable onPress={Keyboard.dismiss} accessible={false}>
          {width > 0 ? (
            <View style={styles.canvas}>
              <TemplateCanvas
                template={template}
                width={width}
                photos={photos}
                texts={texts}
                editing
                onSlot={onSlot}
                onText={(k, v) => setTexts((t) => ({ ...t, [k]: v }))}
              />
            </View>
          ) : null}
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.hint}>
          {Object.keys(template.texts).length ? 'Tap a spot to add a photo. Tap the words to change them.' : 'Tap a spot to add a photo.'}
        </Text>
        <View style={styles.buttons}>
          <Pressable
            style={[styles.btn, styles.secondary, (busy || filled >= template.slots) && styles.disabled]}
            onPress={fillRecent}
            disabled={!!busy || filled >= template.slots}
          >
            {busy === 'fill' ? <ActivityIndicator color={colors.text} /> : <Ionicons name="sparkles-outline" size={18} color={colors.text} />}
            <Text style={styles.secondaryText}>Fill with recent</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.primary, !!busy && styles.disabled]} onPress={save} disabled={!!busy}>
            {busy === 'save' ? <ActivityIndicator color={colors.card} /> : <Ionicons name="download-outline" size={18} color={colors.card} />}
            <Text style={styles.primaryText}>Save to Photos</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={picking != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPicking(null)}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Photo {picking != null ? picking + 1 : ''}</Text>
            <Pressable onPress={() => setPicking(null)} hitSlop={8} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>Cancel</Text>
            </Pressable>
          </View>
          <PermissionGate>
            <PhotoPicker
              onPick={(uri) => {
                if (picking != null) setPhoto(picking, uri);
                setPicking(null);
              }}
            />
          </PermissionGate>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const COLUMNS = 3;

function PhotoPicker({ onPick }: { onPick: (uri: string) => void }) {
  const { width } = useWindowDimensions();
  const { assets, loadMore } = usePhotos();
  const photos = assets.filter((a) => a.mediaType !== 'video');
  return (
    <FlashList
      data={photos}
      numColumns={COLUMNS}
      keyExtractor={(a) => a.id}
      onEndReached={loadMore}
      onEndReachedThreshold={1.5}
      renderItem={({ item }) => (
        <PhotoTile id={item.id} uri={item.uri} size={width / COLUMNS} label="Use this photo" onPress={() => onPick(item.uri)} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hidden: { position: 'absolute', left: 0, top: 0 },
  stage: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  canvas: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  headerBtn: { height: 44, justifyContent: 'center', paddingHorizontal: 8 },
  headerBtnText: { fontSize: 15, fontWeight: '600', color: colors.text },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  hint: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 8 },
  buttons: { flexDirection: 'row', gap: 10, paddingBottom: space.sm },
  btn: {
    flex: 1,
    height: 50,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.text },
  primaryText: { color: colors.card, fontSize: 15, fontWeight: '600' },
  secondary: { backgroundColor: colors.surface },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space.lg,
    paddingRight: 8,
    paddingVertical: 6,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
});

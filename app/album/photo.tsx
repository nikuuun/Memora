import { Ionicons } from '@expo/vector-icons';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../src/components/Text';
import { ZoomableImage } from '../../src/components/ZoomableImage';
import { Avatar } from '../../src/shared/Avatars';
import {
  type SharedPhoto,
  canRemove,
  displayName,
  imageSource,
  isMe,
  isOnThisPhone,
  timeAgo,
  useShared,
} from '../../src/shared/store';
import { colors } from '../../src/theme';

/** Save a copy of someone's photo to this phone's Photos app. */
async function saveToPhone(photo: SharedPhoto) {
  const file = new File(Paths.cache, `memora-${photo.id}.jpg`);
  const source = imageSource(photo, 'full');
  if (!file.exists) await File.downloadFileAsync(source.uri ?? photo.uri, file, { headers: source.headers });
  await MediaLibrary.saveToLibraryAsync(file.uri);
  file.delete();
}

/**
 * Full-screen photo from a shared album. Swipe between photos, pinch or
 * double-tap to zoom, tap to hide the controls. Save a copy, or take it out of
 * the album (never deletes it from anyone's phone).
 */
export default function SharedPhotoScreen() {
  const { id, photo: startId } = useLocalSearchParams<{ id: string; photo: string }>();
  const album = useShared((s) => s.albums.find((a) => a.id === id));
  const removePhoto = useShared((s) => s.removePhoto);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const photos = album?.photos ?? [];
  const [index, setIndex] = useState(() => Math.max(0, photos.findIndex((p) => p.id === startId)));
  const [zoomed, setZoomed] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());

  if (!album || photos.length === 0) {
    return (
      <View style={[styles.safe, styles.center]}>
        <Text style={styles.emptyText}>No photos here.</Text>
        <Pressable style={styles.textBtn} onPress={() => router.back()}>
          <Text style={styles.textBtnLabel}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const current = photos[Math.min(index, photos.length - 1)];
  const onPhone = isOnThisPhone(current);
  const saved = savedIds.has(current.id);
  const when = timeAgo(current.addedAt);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    setZoomed(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveToPhone(current);
      setSavedIds((prev) => new Set(prev).add(current.id));
    } catch {
      Alert.alert('Couldn’t save the photo', 'Check your connection and that Memora can add to your Photos, then try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = () => {
    const mine = isMe(current.addedBy);
    Alert.alert(
      `Remove from “${album.name}”?`,
      `Everyone in the album will stop seeing it. It isn’t deleted from ${mine ? 'your' : 'anyone’s'} phone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removePhoto(album.id, current.id);
            } catch (e) {
              Alert.alert('Couldn’t remove the photo', e instanceof Error ? e.message : 'Please try again.');
              return;
            }
            setZoomed(false);
            if (photos.length === 1) router.back();
            else if (index >= photos.length - 1) setIndex(photos.length - 2);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.safe}>
      <StatusBar style="light" hidden={!chrome} />
      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.id}
        initialScrollIndex={index}
        getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={onScrollEnd}
        windowSize={3}
        renderItem={({ item }) => (
          <ZoomableImage
            source={imageSource(item, 'full')}
            width={width}
            height={height}
            onZoomChange={setZoomed}
            onTap={() => setChrome((c) => !c)}
          />
        )}
      />

      {chrome && (
        <>
          <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel="Close">
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
            <Text style={styles.counter}>
              {Math.min(index, photos.length - 1) + 1} of {photos.length}
            </Text>
            <View style={styles.iconBtn} />
          </View>

          <View style={[styles.bottom, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.byRow}>
              <Avatar album={album} email={current.addedBy} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={styles.byName}>Added by {displayName(album, current.addedBy)}</Text>
                <Text style={styles.byMeta}>{when === 'now' ? 'Just now' : `${when} ago`} · pinch or double-tap to zoom</Text>
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                style={[styles.action, (onPhone || saved || saving) && styles.actionDone]}
                onPress={save}
                disabled={onPhone || saved || saving}
                accessibilityLabel="Save to your Photos"
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name={onPhone || saved ? 'checkmark' : 'download-outline'} size={20} color="#fff" />
                )}
                <Text style={styles.actionText}>
                  {onPhone ? 'In your Photos' : saved ? 'Saved' : saving ? 'Saving…' : 'Save to Photos'}
                </Text>
              </Pressable>
              {canRemove(album, current) && (
                <Pressable style={styles.action} onPress={confirmRemove} accessibilityLabel="Remove from album">
                  <Ionicons name="remove-circle-outline" size={20} color="#fff" />
                  <Text style={styles.actionText}>Remove</Text>
                </Pressable>
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const BAR = 'rgba(0,0,0,0.55)';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: colors.mutedOnDark, fontSize: 15 },
  textBtn: { height: 44, paddingHorizontal: 18, justifyContent: 'center' },
  textBtnLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },

  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BAR,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  counter: { color: '#fff', fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: BAR },
  byRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  byName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  byMeta: { color: colors.mutedOnDark, fontSize: 12, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  action: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionDone: { backgroundColor: 'rgba(255,255,255,0.08)' },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

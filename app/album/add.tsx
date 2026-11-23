import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoTile } from '../../src/components/PhotoTile';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Text } from '../../src/components/Text';
import { PermissionGate } from '../../src/photos/PermissionGate';
import { usePhotos } from '../../src/photos/usePhotos';
import { photoCount, useShared } from '../../src/shared/store';
import { colors, radius, space } from '../../src/theme';

const COLUMNS = 3;
const MAX = 50;

/** Pick photos from the camera roll to add to a shared album. */
export default function AddPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const album = useShared((s) => s.albums.find((a) => a.id === id));
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Add photos" subtitle={album ? `to ${album.name}` : undefined} />
      <PermissionGate>{album ? <Picker albumId={album.id} /> : null}</PermissionGate>
    </SafeAreaView>
  );
}

function Picker({ albumId }: { albumId: string }) {
  const { width } = useWindowDimensions();
  const { assets, loadMore } = usePhotos();
  const addPhotos = useShared((s) => s.addPhotos);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX) next.add(id);
      return next;
    });
  }, []);

  const sample = useShared((s) => s.mode === 'sample');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const add = async () => {
    // Videos come later; big files need uploads that carry on in the background.
    const picked = assets.filter((a) => selected.has(a.id)).map((a) => ({ id: a.id, uri: a.uri }));
    setProgress({ done: 0, total: picked.length });
    try {
      const { failed } = await addPhotos(albumId, picked, (done, total) => setProgress({ done, total }));
      router.back();
      if (failed) {
        Alert.alert(
          `${photoCount(failed)} didn’t upload`,
          'Check your connection and add them again. Photos stored only in iCloud need to download first.',
        );
      }
    } catch (e) {
      setProgress(null);
      Alert.alert('Upload stopped', e instanceof Error ? e.message : 'Please try again.');
    }
  };
  const uploading = progress != null;

  const photos = assets.filter((a) => a.mediaType !== 'video');

  return (
    <View style={{ flex: 1 }}>
      <FlashList
        data={photos}
        numColumns={COLUMNS}
        keyExtractor={(a) => a.id}
        extraData={selected}
        onEndReached={loadMore}
        onEndReachedThreshold={1.5}
        renderItem={({ item }) => (
          <PhotoTile
            id={item.id}
            uri={item.uri}
            size={width / COLUMNS}
            selected={selected.has(item.id)}
            ring
            label={selected.has(item.id) ? 'Selected' : 'Not selected'}
            onPress={uploading ? undefined : toggle}
          />
        )}
      />
      <View style={styles.footer}>
        <Pressable
          style={[styles.addBtn, (!selected.size || uploading) && { opacity: 0.5 }]}
          onPress={add}
          disabled={!selected.size || uploading}
        >
          <Text style={styles.addText}>
            {progress
              ? `Uploading ${progress.done} of ${progress.total}…`
              : selected.size
                ? `Add ${photoCount(selected.size)}`
                : 'Choose photos'}
          </Text>
        </Pressable>
        <Text style={styles.note}>
          {uploading
            ? 'Keep Memora open until it finishes.'
            : selected.size >= MAX
              ? `Up to ${MAX} at a time.`
              : sample
                ? 'Sample album: photos stay on this phone.'
                : 'Uploaded to Google Drive, resized to save space.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line },
  addBtn: {
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: colors.card, fontSize: 16, fontWeight: '600' },
  note: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 10 },
});

import * as MediaLibrary from 'expo-media-library/legacy';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoTile } from '../src/components/PhotoTile';
import { useTrash } from '../src/trash/store';
import { colors, radius, space } from '../src/theme';

const COLUMNS = 4;

/**
 * The only place anything is actually deleted. One batch call means the user
 * sees ONE system confirmation. Deleted items go to the phone's
 * "Recently Deleted" (iOS) or trash (Android 11+) for about 30 days.
 */
export default function ReviewScreen() {
  const { width } = useWindowDimensions();
  const size = width / COLUMNS;
  const queue = useTrash((s) => s.queue);
  const restore = useTrash((s) => s.restore);
  const markDeleted = useTrash((s) => s.markDeleted);
  const [busy, setBusy] = useState(false);

  const items = useMemo(
    () => Object.values(queue).sort((a, b) => b.creationTime - a.creationTime),
    [queue],
  );

  const deleteAll = async () => {
    setBusy(true);
    try {
      // Drop anything the user already deleted in the Photos app; a missing
      // photo can make the whole batch fail.
      const checks = await Promise.allSettled(items.map((p) => MediaLibrary.getAssetInfoAsync(p.id)));
      const stillThere = items.filter((_, i) => {
        const r = checks[i];
        return r.status === 'fulfilled' && r.value != null;
      });
      const gone = items.filter((p) => !stillThere.includes(p)).map((p) => p.id);
      if (gone.length) markDeleted(gone);
      if (stillThere.length === 0) {
        router.back();
        return;
      }

      const ok = await MediaLibrary.deleteAssetsAsync(stillThere.map((p) => p.id));
      if (ok) {
        markDeleted(stillThere.map((p) => p.id));
        router.back();
      } else {
        Alert.alert('Nothing was deleted', 'Your photos are still in the trash queue.');
      }
    } catch {
      // The user tapped "Don't Allow" on the system popup, or something failed.
      Alert.alert('Nothing was deleted', 'Your photos are still in the trash queue.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Text style={styles.hint}>Tap a photo to keep it. Deleted items stay in Recently Deleted for 30 days.</Text>

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        numColumns={COLUMNS}
        renderItem={({ item }) => (
          <PhotoTile
            id={item.id}
            uri={item.uri}
            size={size}
            isVideo={item.mediaType === 'video'}
            onPress={(id) => restore([id])}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>Trash is empty</Text>}
      />

      {items.length > 0 && (
        <Pressable style={[styles.deleteBtn, busy && { opacity: 0.6 }]} onPress={deleteAll} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.deleteText}>
              Delete {items.length} {items.length === 1 ? 'item' : 'items'}
            </Text>
          )}
        </Pressable>
      )}
      {items.length > 0 && (
        <Pressable onPress={() => restore(items.map((p) => p.id))} style={styles.secondary}>
          <Text style={styles.secondaryText}>Keep all</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hint: { color: colors.muted, fontSize: 13, padding: space.lg, textAlign: 'center' },
  empty: { textAlign: 'center', marginTop: 80, color: colors.muted, fontSize: 15 },
  deleteBtn: {
    margin: space.lg,
    marginBottom: space.sm,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  deleteText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: { alignItems: 'center', paddingBottom: space.md },
  secondaryText: { color: colors.text, fontSize: 15 },
});

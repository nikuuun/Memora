import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import * as MediaLibrary from 'expo-media-library/legacy';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoTile } from '../src/components/PhotoTile';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { Text } from '../src/components/Text';
import { openPlayer } from '../src/library/session';
import { forget, setOne, unmarkAll } from '../src/db/actions';
import { STATUS } from '../src/db/db';
import { markedRows } from '../src/db/queries';
import { useDbQuery } from '../src/library/useDbQuery';
import { colors, fonts, items, radius, space } from '../src/theme';

const COLUMNS = 4;
const DEVICE = Platform.OS === 'ios' ? 'iPhone' : 'phone';

/**
 * The only place anything is actually deleted. One batch call means the user
 * sees ONE system confirmation. Deleted items go to the phone's
 * "Recently Deleted" (iOS) or trash (Android 11+) for about 30 days.
 */
export default function ReviewScreen() {
  const { width } = useWindowDimensions();
  const rows = useDbQuery(markedRows, []) ?? [];
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState<number | null>(null);

  const deleteAll = async () => {
    setBusy(true);
    try {
      // Drop anything already deleted in the Photos app; a missing photo can
      // make the whole batch fail.
      const checks = await Promise.allSettled(rows.map((p) => MediaLibrary.getAssetInfoAsync(p.id, { shouldDownloadFromNetwork: false })));
      const stillThere = rows.filter((_, i) => {
        const r = checks[i];
        return r.status === 'fulfilled' && r.value != null;
      });
      const gone = rows.filter((p) => !stillThere.includes(p)).map((p) => p.id);
      if (gone.length) await forget(gone);
      if (!stillThere.length) {
        router.back();
        return;
      }

      const ids = stillThere.map((p) => p.id);
      const ok = await MediaLibrary.deleteAssetsAsync(ids);
      if (ok) {
        await forget(ids);
        setDeleted(ids.length);
      } else {
        Alert.alert('Nothing was deleted', 'Your photos are still marked.');
      }
    } catch {
      // The user tapped "Don't Allow" on the system popup, or something failed.
      Alert.alert('Nothing was deleted', 'Your photos are still marked.');
    } finally {
      setBusy(false);
    }
  };

  if (deleted != null) {
    return (
      <SafeAreaView style={[styles.safe, styles.done]} edges={['top', 'bottom']}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={32} color="#fff" />
        </View>
        <Text style={styles.doneTitle}>Deleted {items(deleted)}</Text>
        <Text style={styles.doneBody}>
          {Platform.OS === 'ios'
            ? 'They are in Recently Deleted on your iPhone for 30 days if you change your mind.'
            : 'They are in your phone’s trash for 30 days if you change your mind.'}
        </Text>
        <Pressable style={styles.doneBtn} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Back to Clean</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Review" subtitle={`${items(rows.length)} marked`} />
      <Text style={styles.info}>
        Nothing has been deleted yet. Tap a photo to unmark it. When you delete, these move to Recently Deleted on your{' '}
        {DEVICE}, where you can recover them for 30 days.
      </Text>

      <View style={{ flex: 1 }}>
        <FlashList
          data={rows}
          numColumns={COLUMNS}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PhotoTile
              id={item.id}
              uri={item.uri}
              size={width / COLUMNS}
              duration={item.media_type === 'video' ? item.duration : undefined}
              label="Marked. Tap to unmark."
              onPress={(id) => setOne(id, STATUS.marked, STATUS.todo)}
              onPlay={openPlayer}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>Nothing is marked.</Text>}
        />
      </View>

      {rows.length > 0 && (
        <View style={styles.footer}>
          <Pressable style={[styles.deleteBtn, busy && { opacity: 0.6 }]} onPress={deleteAll} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteText}>
                Delete {items(rows.length)} from {DEVICE}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={unmarkAll} style={styles.secondary} disabled={busy}>
            <Text style={styles.secondaryText}>Unmark all</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  info: {
    marginHorizontal: space.lg,
    marginTop: space.xs,
    marginBottom: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  empty: { textAlign: 'center', marginTop: 60, color: colors.muted, fontSize: 15 },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line },
  deleteBtn: {
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.text, fontSize: 15 },
  done: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: space.xl },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.keep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { fontFamily: fonts.serif, fontSize: 26, color: colors.text },
  doneBody: { fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', maxWidth: 280 },
  doneBtn: {
    marginTop: space.md,
    height: 48,
    paddingHorizontal: 22,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    justifyContent: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

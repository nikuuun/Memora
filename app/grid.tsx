import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoTile } from '../src/components/PhotoTile';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { applyChanges } from '../src/db/actions';
import { STATUS } from '../src/db/db';
import { openPlayer } from '../src/library/session';
import { useLibrary } from '../src/library/store';
import { colors, formatCount, items, radius, space } from '../src/theme';

const COLUMNS = 3;

/**
 * To review → "Select all": everything starts marked, tap the ones to keep.
 *   Confirm marks the rest and moves the kept ones to Reviewed.
 * Reviewed → "Pick to delete": nothing starts marked, tap the ones to mark.
 */
export default function GridScreen() {
  const session = useLibrary((s) => s.session);
  const showToast = useLibrary((s) => s.showToast);
  const { width } = useWindowDimensions();
  // In "todo" mode this holds the photos to KEEP; in "reviewed" mode, the ones to MARK.
  const [toggled, setToggled] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  if (!session) return null;
  const { rows, mode, title } = session;
  const todo = mode === 'todo';
  const isMarked = (id: string) => (todo ? !toggled.has(id) : toggled.has(id));
  const markedCount = todo ? rows.length - toggled.size : toggled.size;
  const keepCount = rows.length - markedCount;
  const allMarked = markedCount === rows.length;

  const toggle = (id: string) =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => {
    const everyone = new Set(rows.map((r) => r.id));
    // "Mark all" / "Unmark all", whichever way the button reads.
    if (todo) setToggled(allMarked ? everyone : new Set());
    else setToggled(allMarked ? new Set() : everyone);
  };

  const confirm = async () => {
    setSaving(true);
    const changes = rows.map((r) => ({
      id: r.id,
      prev: r.status,
      next: isMarked(r.id) ? STATUS.marked : todo ? STATUS.reviewed : r.status,
    }));
    const undo = await applyChanges(changes);
    const parts = [];
    if (markedCount) parts.push(`${formatCount(markedCount)} marked`);
    if (todo && keepCount) parts.push(`${formatCount(keepCount)} moved to Reviewed`);
    showToast(parts.length ? `${parts.join(', ')}. Nothing deleted yet.` : 'Nothing changed.', parts.length ? undo : undefined);
    router.back();
  };

  let confirmLabel: string;
  if (!todo) confirmLabel = markedCount ? `Mark ${items(markedCount)}` : 'Done';
  else if (markedCount === 0) confirmLabel = `Keep all ${formatCount(rows.length)}`;
  else if (keepCount === 0) confirmLabel = `Mark all ${formatCount(rows.length)}`;
  else confirmLabel = `Mark ${formatCount(markedCount)}, keep ${formatCount(keepCount)}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title={title}
        subtitle={`${formatCount(markedCount)} of ${formatCount(rows.length)} marked`}
        right={
          <Pressable onPress={toggleAll} hitSlop={8} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>{allMarked ? 'Unmark all' : 'Mark all'}</Text>
          </Pressable>
        }
      />
      <Text style={styles.hint}>
        {todo
          ? 'Tap a photo to keep it. Kept photos move to Reviewed. Marked photos stay on your phone until you delete them in Review.'
          : 'Tap the photos you want to mark for deletion. The rest stay in Reviewed.'}
      </Text>
      <View style={{ flex: 1 }}>
        <FlashList
          data={rows}
          numColumns={COLUMNS}
          keyExtractor={(r) => r.id}
          extraData={toggled}
          renderItem={({ item }) => {
            const marked = isMarked(item.id);
            return (
              <PhotoTile
                id={item.id}
                uri={item.uri}
                size={width / COLUMNS}
                duration={item.media_type === 'video' ? item.duration : undefined}
                selected={marked}
                ring={!marked}
                label={marked ? 'Marked. Tap to keep.' : 'Keeping. Tap to mark.'}
                onPress={toggle}
                onPlay={openPlayer}
              />
            );
          }}
        />
      </View>
      <View style={styles.footer}>
        <Pressable style={[styles.confirm, saving && { opacity: 0.6 }]} onPress={confirm} disabled={saving}>
          <Text style={styles.confirmText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerBtn: { height: 44, justifyContent: 'center', paddingHorizontal: 4 },
  headerBtnText: { fontSize: 14, color: colors.text },
  hint: { fontSize: 13, lineHeight: 18, color: colors.muted, paddingHorizontal: space.lg, paddingBottom: 10 },
  footer: { padding: space.lg, paddingBottom: space.sm, borderTopWidth: 1, borderTopColor: colors.line },
  confirm: { height: 50, borderRadius: radius.lg, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

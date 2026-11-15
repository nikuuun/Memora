import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkedBar } from '../src/components/BottomBars';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { SwipeCard, type SwipeDirection } from '../src/components/SwipeCard';
import { setOne } from '../src/db/actions';
import { STATUS, type Row, type Status } from '../src/db/db';
import { openPlayer } from '../src/library/session';
import { useLibrary } from '../src/library/store';
import { colors, formatCount, radius, space } from '../src/theme';

type Step = { id: string; prev: Status; next: Status };

/** One by one: left / Mark = marked for deletion, right / Keep = moves to Reviewed. */
export default function DeckScreen() {
  const session = useLibrary((s) => s.session);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<Step[]>([]);

  const decide = useCallback(async (item: Row, dir: SwipeDirection) => {
    const next = dir === 'mark' ? STATUS.marked : STATUS.reviewed;
    setHistory((h) => [...h, { id: item.id, prev: item.status, next }]);
    setIndex((i) => i + 1);
    await setOne(item.id, item.status, next);
  }, []);

  const undo = async () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => i - 1);
    await setOne(last.id, last.next, last.prev);
  };

  if (!session) return null;
  const { rows, title } = session;
  const current = rows[index];
  const marked = history.filter((s) => s.next === STATUS.marked).length;
  const kept = history.length - marked;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title={title}
        subtitle={current ? `${formatCount(index + 1)} of ${formatCount(rows.length)}` : 'Done'}
      />

      {current ? (
        <>
          <View style={styles.deck}>
            {[rows[index + 1], current]
              .filter((r): r is Row => !!r)
              .map((r) => (
                <SwipeCard key={r.id} item={r} isTop={r.id === current.id} onSwiped={decide} onPlay={openPlayer} />
              ))}
          </View>
          <Text style={styles.hint}>Swipe left to mark, right to keep. Kept photos move to Reviewed.</Text>
          <View style={styles.controls}>
            <Pressable
              onPress={undo}
              disabled={!history.length}
              accessibilityLabel="Undo"
              style={[styles.square, !history.length && { opacity: 0.4 }]}
            >
              <Ionicons name="arrow-undo" size={20} color={colors.text} />
            </Pressable>
            <Pressable style={styles.choice} onPress={() => decide(current, 'mark')}>
              <Text style={styles.choiceText}>Mark</Text>
            </Pressable>
            <Pressable style={styles.choice} onPress={() => decide(current, 'keep')}>
              <Text style={styles.choiceText}>Keep</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.done}>
          <Text style={styles.doneTitle}>{rows.length ? 'Group finished' : 'Nothing left here'}</Text>
          <Text style={styles.doneBody}>
            {formatCount(marked)} marked, {formatCount(kept)} moved to Reviewed.
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Back to results</Text>
          </Pressable>
        </View>
      )}

      <MarkedBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  deck: { flex: 1, marginHorizontal: space.lg, marginTop: space.sm },
  hint: { textAlign: 'center', fontSize: 13, color: colors.muted, paddingTop: space.md, paddingBottom: space.sm },
  controls: { flexDirection: 'row', gap: 10, paddingHorizontal: space.lg, paddingBottom: space.md },
  square: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choice: {
    flex: 1,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: { fontSize: 16, fontWeight: '600', color: colors.text },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: space.xl },
  doneTitle: { fontSize: 20, fontWeight: '600', color: colors.text },
  doneBody: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  doneBtn: {
    marginTop: space.sm,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    justifyContent: 'center',
  },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

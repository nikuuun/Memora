import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { scopeCounts } from '../db/queries';
import { useLibrary } from '../library/store';
import { useDbQuery } from '../library/useDbQuery';
import { colors, items, radius, space } from '../theme';
import { Text } from './Text';

/** "18 items marked. Nothing deleted yet." with Undo; disappears after 5 seconds. */
export function UndoToast() {
  const toast = useLibrary((s) => s.toast);
  const hide = useLibrary((s) => s.hideToast);
  if (!toast) return null;
  return (
    <View style={styles.toast}>
      <Text style={styles.toastText}>{toast.text}</Text>
      {toast.undo && (
        <Pressable
          hitSlop={8}
          style={styles.undo}
          onPress={async () => {
            hide();
            await toast.undo?.();
          }}
        >
          <Text style={styles.undoText}>Undo</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Always visible while anything is marked, so it's clear nothing is deleted yet. */
export function MarkedBar() {
  const counts = useDbQuery(scopeCounts, []);
  const marked = counts?.marked ?? 0;
  if (!marked) return null;
  return (
    <View style={styles.bar}>
      <View style={{ flex: 1 }}>
        <Text style={styles.barTitle}>{items(marked)} marked</Text>
        <Text style={styles.barSub}>Nothing is deleted until you review</Text>
      </View>
      <Pressable style={styles.barButton} onPress={() => router.push('/review')}>
        <Text style={styles.barButtonText}>Review & delete</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    minHeight: 44,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  toastText: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 10 },
  undo: { height: 40, paddingHorizontal: 12, justifyContent: 'center' },
  undoText: { fontSize: 14, fontWeight: '600', color: colors.text, textDecorationLine: 'underline' },
  bar: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    padding: space.sm,
    paddingLeft: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  barSub: { color: colors.mutedOnDark, fontSize: 12, marginTop: 1 },
  barButton: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  barButtonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});

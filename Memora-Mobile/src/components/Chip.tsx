import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, space } from '../theme';

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.active]}>
      <Text style={[styles.text, active && styles.activeText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  active: { backgroundColor: colors.text, borderColor: colors.text },
  text: { fontSize: 13, color: colors.text },
  activeText: { color: colors.bg, fontWeight: '600' },
});

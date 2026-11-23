import { Pressable, StyleSheet } from 'react-native';

import { colors, formatCount, radius } from '../theme';
import { Text } from './Text';

/** A small rectangular keyword tag with its count. */
export function Chip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.active]}
    >
      <Text style={[styles.text, active && styles.activeText]}>{label}</Text>
      {count != null && <Text style={[styles.count, active && styles.activeCount]}>{formatCount(count)}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
  },
  active: { backgroundColor: colors.text, borderColor: colors.text },
  text: { fontSize: 13, fontWeight: '500', color: colors.text },
  activeText: { color: colors.bg, fontWeight: '600' },
  count: { fontSize: 12, color: colors.muted },
  activeCount: { color: colors.mutedOnDark },
});

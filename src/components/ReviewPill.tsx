import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors, formatCount } from '../theme';
import { Text } from './Text';

/** Outlined pill in a screen header: "Review 12". Opens Review, where nothing is deleted until you confirm. */
export function ReviewPill({ count }: { count: number }) {
  return (
    <Pressable
      onPress={() => router.push('/review')}
      accessibilityRole="button"
      accessibilityLabel={`Review ${formatCount(count)} marked`}
      style={styles.pill}
    >
      <Ionicons name="trash-outline" size={16} color={colors.text} />
      <Text style={styles.text}>Review {formatCount(count)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: { fontSize: 13, fontWeight: '600', color: colors.text },
});

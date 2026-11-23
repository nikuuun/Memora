import { StyleSheet, View } from 'react-native';

import { Text } from '../components/Text';
import { colors, fonts } from '../theme';
import { type Album, initials, tone } from './store';

/** One round initials badge in the person's colour. */
export function Avatar({ album, email, size = 28 }: { album: Album; email: string; size?: number }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone(email) }]}>
      <Text style={[styles.text, { fontSize: Math.round(size * 0.36) }]}>{initials(album, email)}</Text>
    </View>
  );
}

/** Overlapping avatars for the first few members, then "+N". */
export function AvatarStack({ album, max = 3, size = 26 }: { album: Album; max?: number; size?: number }) {
  const shown = album.members.slice(0, max);
  const extra = album.members.length - shown.length;
  return (
    <View style={styles.row}>
      {shown.map((m, i) => (
        <View key={m.email} style={[styles.ring, { marginLeft: i ? -size * 0.3 : 0, borderRadius: size }]}>
          <Avatar album={album} email={m.email} size={size} />
        </View>
      ))}
      {extra > 0 && (
        <View style={[styles.ring, { marginLeft: -size * 0.3, borderRadius: size }]}>
          <View style={[styles.circle, styles.more, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={[styles.text, { fontSize: Math.round(size * 0.36), color: colors.text }]}>+{extra}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  ring: { borderWidth: 2, borderColor: colors.card },
  circle: { alignItems: 'center', justifyContent: 'center' },
  more: { backgroundColor: colors.surface },
  text: { fontFamily: fonts.bold, color: '#fff', letterSpacing: 0.3 },
});

import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, eyebrowStyle, fonts, space } from '../theme';
import { Text } from './Text';

/** Placeholder for a tab that isn't built yet, in the Memora style. */
export function ComingSoon(props: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.center}>
        <View style={styles.icon}>
          <Ionicons name={props.icon} size={28} color={colors.text} />
        </View>
        <Text style={eyebrowStyle}>COMING SOON</Text>
        <Text style={styles.title}>{props.title}</Text>
        <Text style={styles.body}>{props.body}</Text>
        {props.children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: 10 },
  icon: { backgroundColor: colors.surface, padding: 16, borderRadius: 16, marginBottom: 8 },
  title: { fontFamily: fonts.serif, fontSize: 30, color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 23, color: colors.muted, textAlign: 'center', maxWidth: 320 },
});

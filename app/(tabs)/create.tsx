import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ComingSoon } from '../../src/components/ComingSoon';
import { Text } from '../../src/components/Text';
import { colors, fonts, radius } from '../../src/theme';

// Placeholder: stories built from templates (design/Linnie_template_layouts.png),
// then AI that picks the template, colours and words from a prompt.
export default function CreateScreen() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  return (
    <ComingSoon
      icon="albums-outline"
      title="Create a story"
      body="Pick a template, add your photos, and save it as an image. Templates come first, then AI that shapes a story from a few words."
    >
      {prompt ? (
        <View style={styles.idea}>
          <Text style={styles.ideaLabel}>Your idea</Text>
          <Text style={styles.ideaText}>“{prompt}”</Text>
        </View>
      ) : null}
    </ComingSoon>
  );
}

const styles = StyleSheet.create({
  idea: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.studio,
    alignItems: 'center',
    maxWidth: 320,
  },
  ideaLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  ideaText: { fontFamily: fonts.serifItalic, fontSize: 18, lineHeight: 25, color: colors.text, textAlign: 'center', marginTop: 4 },
});

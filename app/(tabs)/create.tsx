import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '../../src/components/Text';
import { type Template, TEMPLATES, TemplateCanvas } from '../../src/create/templates';
import { colors, eyebrowStyle, fonts, radius, space, titleStyle } from '../../src/theme';

const GAP = 14;

// Two columns, each stacked independently so tall templates don't leave gaps.
const COLUMNS: Template[][] = [[], []];
{
  const heights = [0, 0];
  for (const t of TEMPLATES) {
    const col = heights[0] <= heights[1] ? 0 : 1;
    COLUMNS[col].push(t);
    heights[col] += t.height;
  }
}

/** Template gallery. Pick one to fill it with photos and save it as an image. */
export default function CreateScreen() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const { width } = useWindowDimensions();
  const cell = (width - space.lg * 2 - GAP) / 2;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={eyebrowStyle}>TEMPLATES</Text>
        <Text style={styles.title}>Create a story</Text>
        <Text style={styles.body}>Pick a layout, add your photos and words, then save it to your library.</Text>

        {prompt ? (
          <View style={styles.idea}>
            <Text style={styles.ideaLabel}>Your idea</Text>
            <Text style={styles.ideaText}>“{prompt}”</Text>
            <Text style={styles.ideaNote}>AI that shapes a story from your words is coming. For now, start from a template.</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {COLUMNS.map((col, c) => (
            <View key={c} style={{ width: cell, gap: GAP }}>
              {col.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => router.push({ pathname: '/create/[id]', params: { id: t.id } })}
                  accessibilityLabel={`${t.name} template, ${t.slots} photos`}
                  style={({ pressed }) => pressed && { opacity: 0.7 }}
                >
                  <View style={styles.thumb} pointerEvents="none">
                    <TemplateCanvas template={t} width={cell} />
                  </View>
                  <Text style={styles.name}>{t.name}</Text>
                  <Text style={styles.meta}>{t.slots === 1 ? '1 photo' : `${t.slots} photos`}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xl },
  title: { ...titleStyle, marginTop: 6 },
  body: { fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 6 },
  idea: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.studio,
  },
  ideaLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  ideaText: { fontFamily: fonts.serifItalic, fontSize: 18, lineHeight: 25, color: colors.text, marginTop: 4 },
  ideaNote: { fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 6 },
  grid: { flexDirection: 'row', gap: GAP, marginTop: space.xl },
  thumb: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  name: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 8 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 1 },
});

import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../src/theme';

// Placeholder: AI carousels and albums built from templates, editable afterwards.
export default function CreateScreen() {
  return (
    <View style={styles.center}>
      <Text style={styles.text}>Create coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  text: { color: colors.muted, fontSize: 15 },
});

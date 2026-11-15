import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../src/theme';

// Placeholder: digicam camera with filters. Saves to Photos and keeps a Memora copy.
export default function CameraScreen() {
  return (
    <View style={styles.center}>
      <Text style={styles.text}>Camera coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  text: { color: colors.muted, fontSize: 15 },
});

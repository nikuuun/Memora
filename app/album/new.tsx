import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Text, TextInput } from '../../src/components/Text';
import { EmailInvites } from '../../src/shared/EmailInvites';
import { useShared } from '../../src/shared/store';
import { colors, eyebrowStyle, fonts, radius, space } from '../../src/theme';

/** Name the album and list the Google accounts to invite as editors. */
export default function NewAlbumScreen() {
  const createAlbum = useShared((s) => s.createAlbum);
  const sample = useShared((s) => s.mode === 'sample');
  const [name, setName] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const ready = name.trim().length > 0 && !busy;

  const create = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const { id, failed } = await createAlbum(name.trim(), emails);
      router.replace(`/album/${id}`);
      if (failed.length) {
        Alert.alert(
          'Some invites didn’t send',
          `The album is ready, but these couldn’t be invited: ${failed.join(', ')}. Check the addresses and try again from Invite.`,
        );
      }
    } catch (e) {
      setBusy(false);
      Alert.alert('Couldn’t create the album', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title="New shared album"
        right={
          <Pressable onPress={create} disabled={!ready} style={styles.headerBtn} hitSlop={4}>
            <Text style={[styles.headerBtnText, !ready && { opacity: 0.4 }]}>Create</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={eyebrowStyle}>ALBUM NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Saltwater days"
            placeholderTextColor="#BDB8AA"
            style={styles.name}
            autoFocus
            maxLength={60}
            returnKeyType="next"
            accessibilityLabel="Album name"
          />

          <Text style={[eyebrowStyle, { marginTop: 28 }]}>INVITE PEOPLE</Text>
          <Text style={styles.help}>
            Add their Google account emails. Each person gets an invite from Google Drive and can add photos straight away.
          </Text>
          <EmailInvites emails={emails} onChange={setEmails} />

          <View style={styles.note}>
            <Text style={styles.noteTitle}>How shared albums work</Text>
            <Text style={styles.noteText}>
              {'•'} The album is a folder in your Google Drive.{'\n'}
              {'•'} Everyone invited can view and add photos.{'\n'}
              {'•'} Photos people add use their own Drive storage.{'\n'}
              {'•'} You can remove people at any time.
            </Text>
          </View>

          <Pressable style={[styles.createBtn, !ready && { opacity: 0.4 }]} onPress={create} disabled={!ready}>
            {busy ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.createText}>
                {emails.length ? `Create and invite ${emails.length}` : 'Create album'}
              </Text>
            )}
          </Pressable>
          {sample && (
            <Text style={styles.preview}>Sample mode: sign in with Google on the Shared tab to send real invites.</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: 40 },
  headerBtn: { height: 44, paddingHorizontal: 8, justifyContent: 'center' },
  headerBtnText: { fontSize: 16, fontWeight: '600', color: colors.text },
  name: {
    fontFamily: fonts.serif,
    fontSize: 30,
    color: colors.text,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  help: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 6, marginBottom: 12 },
  note: { marginTop: 28, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.studio },
  noteTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 },
  noteText: { fontSize: 14, lineHeight: 22, color: colors.text },
  createBtn: {
    marginTop: 24,
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: { color: colors.card, fontSize: 16, fontWeight: '600' },
  preview: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 10 },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Text } from '../../src/components/Text';
import { Avatar } from '../../src/shared/Avatars';
import { EmailInvites } from '../../src/shared/EmailInvites';
import { fullName, isMe, isOwner, peopleCount, useShared } from '../../src/shared/store';
import { colors, eyebrowStyle, radius, space } from '../../src/theme';

/** Who's in the album. The owner can invite and remove people; anyone can leave. */
export default function PeopleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const album = useShared((s) => s.albums.find((a) => a.id === id));
  const invite = useShared((s) => s.invite);
  const removeMember = useShared((s) => s.removeMember);
  const leave = useShared((s) => s.leave);
  const sample = useShared((s) => s.mode === 'sample');
  const [emails, setEmails] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (!album) return null;
  const owner = isOwner(album);

  const oops = (title: string, e: unknown) => Alert.alert(title, e instanceof Error ? e.message : 'Please try again.');

  const send = async () => {
    setBusy(true);
    try {
      const { failed } = await invite(album.id, emails);
      setEmails(failed);
      if (failed.length) {
        Alert.alert('Some invites didn’t send', `Check these addresses and try again: ${failed.join(', ')}.`);
      }
    } catch (e) {
      oops('Couldn’t send the invites', e);
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = (email: string, label: string) =>
    Alert.alert(`Remove ${label}?`, 'They won’t see this album any more. Photos they added stay in the album.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeMember(album.id, email).catch((e) => oops('Couldn’t remove them', e)),
      },
    ]);

  const confirmLeave = () =>
    Alert.alert(`Leave “${album.name}”?`, 'The album disappears from your Shared tab. Photos you added stay in it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          leave(album.id)
            .then(() => router.dismissTo('/shared'))
            .catch((e) => oops('Couldn’t leave the album', e));
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="People" subtitle={peopleCount(album.members.length)} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {owner ? (
            <>
              <Text style={eyebrowStyle}>INVITE BY GOOGLE EMAIL</Text>
              <Text style={styles.help}>They’ll get an invite from Google Drive and can add photos straight away.</Text>
              <EmailInvites emails={emails} onChange={setEmails} taken={album.members.map((m) => m.email)} />
              {emails.length > 0 && (
                <Pressable style={[styles.sendBtn, busy && { opacity: 0.6 }]} onPress={send} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color={colors.card} />
                  ) : (
                    <Text style={styles.sendText}>
                      Invite {emails.length} {emails.length === 1 ? 'person' : 'people'}
                    </Text>
                  )}
                </Pressable>
              )}
            </>
          ) : (
            <Text style={styles.help}>Only the person who made this album can invite or remove people.</Text>
          )}

          <Text style={[eyebrowStyle, { marginTop: 28, marginBottom: 10 }]}>IN THIS ALBUM</Text>
          <View style={styles.list}>
            {album.members.map((m, i) => {
              const label = fullName(album, m.email);
              const known = label !== m.email && !isMe(m.email);
              return (
                <View key={m.email} style={[styles.row, i > 0 && styles.rowLine]}>
                  <Avatar album={album} email={m.email} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {label}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {m.role === 'owner' ? 'Owner' : 'Can add photos'}
                      {known ? ` · ${m.email}` : ''}
                    </Text>
                  </View>
                  {owner && m.role !== 'owner' && (
                    <Pressable onPress={() => confirmRemove(m.email, label)} style={styles.rowBtn}>
                      <Text style={styles.rowBtnText}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          {!owner && (
            <Pressable style={styles.leaveBtn} onPress={confirmLeave}>
              <Text style={styles.leaveText}>Leave album</Text>
            </Pressable>
          )}
          {sample && <Text style={styles.preview}>Sample album: changes stay on this phone.</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: 40 },
  help: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 6, marginBottom: 12 },
  sendBtn: {
    marginTop: 14,
    height: 50,
    borderRadius: radius.lg,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: colors.card, fontSize: 16, fontWeight: '600' },
  list: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  rowBtn: { height: 44, paddingHorizontal: 8, justifyContent: 'center' },
  rowBtnText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  leaveBtn: { marginTop: 20, height: 44, alignItems: 'center', justifyContent: 'center' },
  leaveText: { fontSize: 15, fontWeight: '600', color: colors.text },
  preview: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 16 },
});

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text, TextInput } from '../components/Text';
import { colors, radius, space } from '../theme';
import { isEmail } from './store';

/**
 * Type a Google email, tap Add (or return). Each one becomes a removable chip.
 * `taken` are people already in the album, so they can't be added twice.
 */
export function EmailInvites({
  emails,
  onChange,
  taken = [],
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
  taken?: string[];
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const email = draft.trim().toLowerCase();
    if (!email) return;
    if (!isEmail(email)) return setError('That doesn’t look like an email address.');
    if (emails.includes(email) || taken.includes(email)) return setError('That person is already on the list.');
    onChange([...emails, email]);
    setDraft('');
    setError(null);
  };

  return (
    <View>
      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            if (error) setError(null);
          }}
          onSubmitEditing={add}
          placeholder="friend@gmail.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          returnKeyType="done"
          submitBehavior="submit"
          style={styles.input}
          accessibilityLabel="Google email address"
        />
        <Pressable
          onPress={add}
          disabled={!draft.trim()}
          style={[styles.addBtn, !draft.trim() && { opacity: 0.4 }]}
          accessibilityLabel="Add email"
        >
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {emails.length > 0 && (
        <View style={styles.chips}>
          {emails.map((e) => (
            <View key={e} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {e}
              </Text>
              <Pressable
                onPress={() => onChange(emails.filter((x) => x !== e))}
                style={styles.chipX}
                accessibilityLabel={`Remove ${e}`}
              >
                <Ionicons name="close" size={16} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 50,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  input: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 12 },
  addBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: colors.card, fontSize: 14, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
    height: 40,
    paddingLeft: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  chipText: { fontSize: 14, color: colors.text, flexShrink: 1 },
  chipX: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
});

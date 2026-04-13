import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useProfile, saveProfileRemote } from '../services/profileData';
import { GradientBackground } from '../ui/GradientBackground';
import { fonts, tokens } from '../theme/tokens';

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const profile = useProfile(user ?? null);

  const [nickname, setNickname] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setNickname(profile.nickname?.trim() ?? '');
    setDisplayName(profile.displayName?.trim() ?? '');
    setBio(profile.bio?.trim() ?? '');
    setHeightCm(profile.heightCm != null ? String(profile.heightCm) : '');
    setWeightKg(profile.weightKg != null ? String(profile.weightKg) : '');
  }, [profile]);

  async function save(): Promise<void> {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await saveProfileRemote({
        nickname,
        displayName,
        bio,
        heightCm: heightCm.trim() === '' ? null : Number(heightCm),
        weightKg: weightKg.trim() === '' ? null : Number(weightKg),
      });
      setMessage('Profile saved.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <GradientBackground>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.hint}>
        Your nickname appears in the header. Other fields are optional and stored only in your Firestore profile.
      </Text>

      {user?.email ? (
        <View style={styles.emailBox}>
          <Text style={styles.label}>Account email</Text>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.lock}>(from sign-in)</Text>
        </View>
      ) : null}

      {message ? <Text style={styles.msgOk}>{message}</Text> : null}
      {error ? <Text style={styles.msgErr}>{error}</Text> : null}

      <Text style={styles.fieldLabel}>Nickname</Text>
      <TextInput
        style={styles.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder="How we greet you in the app"
        placeholderTextColor={tokens.textMuted}
        maxLength={40}
      />

      <Text style={styles.fieldLabel}>Display name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Full name (optional)"
        placeholderTextColor={tokens.textMuted}
        maxLength={80}
      />

      <Text style={styles.fieldLabel}>Bio</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={bio}
        onChangeText={setBio}
        placeholder="Goals, injuries to remember, training style…"
        placeholderTextColor={tokens.textMuted}
        maxLength={500}
        multiline
      />

      <View style={styles.row2}>
        <View style={styles.half}>
          <Text style={styles.fieldLabel}>Height (cm)</Text>
          <TextInput
            style={styles.input}
            value={heightCm}
            onChangeText={setHeightCm}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={tokens.textMuted}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.fieldLabel}>Body weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={weightKg}
            onChangeText={setWeightKg}
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={tokens.textMuted}
          />
        </View>
      </View>

      <Pressable style={[styles.saveOuter, busy && styles.saveDisabled]} onPress={save} disabled={busy}>
        <LinearGradient
          colors={[tokens.accent, '#0d9488']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.save}
        >
          {busy ? (
            <ActivityIndicator color="#042f2e" />
          ) : (
            <Text style={styles.saveText}>Save profile</Text>
          )}
        </LinearGradient>
      </Pressable>

      <Pressable style={styles.signOut} onPress={() => void signOut()} accessibilityRole="button">
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 48, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    letterSpacing: -0.5,
    fontWeight: '700',
    color: tokens.text,
  },
  hint: {
    fontFamily: fonts.body,
    marginTop: 8,
    color: tokens.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  emailBox: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    fontWeight: '700',
    color: tokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  email: { fontFamily: fonts.bodySemi, color: tokens.text, fontSize: 15, marginTop: 4, fontWeight: '600' },
  lock: { fontFamily: fonts.body, color: tokens.textMuted, fontSize: 13, marginTop: 4 },
  msgOk: { fontFamily: fonts.body, color: tokens.pr, marginBottom: 12, fontSize: 14 },
  msgErr: { fontFamily: fonts.body, color: tokens.danger, marginBottom: 12, fontSize: 14 },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    fontWeight: '700',
    color: tokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 12,
    color: tokens.text,
    backgroundColor: tokens.surface2,
    fontSize: 15,
    fontFamily: fonts.body,
  },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  saveOuter: { marginTop: 24, borderRadius: 999, overflow: 'hidden' },
  save: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.45 },
  saveText: {
    fontFamily: fonts.displayBold,
    fontWeight: '700',
    color: '#042f2e',
    fontSize: 15,
  },
  signOut: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    fontWeight: '600',
    color: tokens.textSecondary,
  },
});

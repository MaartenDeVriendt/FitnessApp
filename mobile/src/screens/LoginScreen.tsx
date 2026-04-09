import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { login, signUp } from '../lib/authActions';
import { GradientBackground } from '../ui/GradientBackground';
import { fonts, tokens } from '../theme/tokens';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password, displayName || undefined);
      } else {
        await login(email, password);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  const valid = email.trim().length > 0 && password.length >= 6;

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <LinearGradient
              colors={[tokens.accent, '#818cf8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardTopAccent}
            />
            <Text style={styles.title}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
            <Text style={styles.hint}>
              Firebase Auth (email / password). Data stays under your UID in Firestore.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {mode === 'signup' ? (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Display name (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Display name (optional)"
                  placeholderTextColor={tokens.textMuted}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
              </View>
            ) : null}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={tokens.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={tokens.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <Pressable
              style={[styles.buttonOuter, (!valid || busy) && styles.buttonDisabled]}
              onPress={submit}
              disabled={!valid || busy}
            >
              <LinearGradient
                colors={[tokens.accent, '#14b8a6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.button}
              >
                {busy ? (
                  <ActivityIndicator color="#042f2e" />
                ) : (
                  <Text style={styles.buttonText}>{mode === 'login' ? 'Sign in' : 'Sign up'}</Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => {
                setMode((m) => (m === 'login' ? 'signup' : 'login'));
                setError(null);
              }}
            >
              <Text style={styles.link}>
                {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 48, maxWidth: 400, width: '100%', alignSelf: 'center' },
  card: {
    borderRadius: tokens.radiusLg,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
    overflow: 'hidden',
    ...tokens.shadowCard,
  },
  cardTopAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, opacity: 0.95 },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    letterSpacing: -0.5,
    color: tokens.text,
    fontWeight: '700',
    marginBottom: 6,
  },
  hint: {
    fontFamily: fonts.body,
    marginBottom: 20,
    color: tokens.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  field: { marginBottom: 14, gap: 6 },
  fieldLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    fontWeight: '600',
    color: tokens.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: fonts.body,
    color: tokens.text,
    backgroundColor: tokens.surface2,
  },
  error: {
    fontFamily: fonts.body,
    color: tokens.danger,
    fontSize: 14,
    padding: 10,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.dangerBg,
    marginBottom: 12,
  },
  buttonOuter: { marginTop: 6, borderRadius: tokens.radiusSm, overflow: 'hidden' },
  button: { paddingVertical: 13, alignItems: 'center' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    fontFamily: fonts.displayBold,
    fontSize: 15,
    fontWeight: '700',
    color: '#042f2e',
    letterSpacing: 0.3,
  },
  link: {
    marginTop: 20,
    fontFamily: fonts.bodyMedium,
    color: tokens.accent,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});

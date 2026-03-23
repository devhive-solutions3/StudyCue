import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter, Link } from 'expo-router';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import GlassCard from '../../components/GlassCard';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import { colors } from '../../lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7870/ingest/023ceaa3-2d5e-4c09-b124-cb1b35bfbe5e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b1399d' },
      body: JSON.stringify({
        sessionId: 'b1399d',
        location: 'app/(auth)/login.tsx:mounted',
        message: 'LoginScreen mounted',
        hypothesisId: 'H2',
        data: {},
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // #endregion

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in both fields.');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Auth state listener in _layout.tsx will redirect us
    } catch (e: any) {
      setError(e.message || 'Failed to login');
      setLoading(false);
    }
  };

  return (
    <GlowBackground>
      <View style={styles.container}>
        <StaggeredFadeIn index={0}>
          <GlassCard style={styles.panel} tintColor="rgba(124,98,255,0.12)">
            <Text style={styles.title}>
              <Text style={styles.studyText}>Study</Text>
              <Text style={styles.cueText}>Cue</Text>
            </Text>
            <Text style={styles.subtitle}>Study smarter, not harder — with AI on your side.</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.inkMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.inkMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <GlassButton label="Sign In" onPress={handleLogin} loading={loading} style={styles.button} />

            <View style={styles.links}>
              <Link href="/(auth)/register" style={styles.linkText}>
                Create Account
              </Link>
              <Link href="/(auth)/forgot-password" style={styles.linkText}>
                Forgot Password?
              </Link>
            </View>
          </GlassCard>
        </StaggeredFadeIn>
      </View>
    </GlowBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  panel: {
    padding: 8,
  },
  title: {
    fontSize: 42,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  studyText: {
    color: '#1E293B',
  },
  cueText: {
    color: '#22C55E',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkMuted,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 28,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.46)',
    color: colors.ink,
    fontFamily: 'Inter_400Regular',
    borderColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    marginTop: 8,
  },
  error: {
    color: colors.danger,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  linkText: {
    color: colors.indigo,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});

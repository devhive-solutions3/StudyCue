import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Link } from 'expo-router';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import GlassCard from '../../components/GlassCard';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import { colors } from '../../lib/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleReset = async () => {
    if (!email) {
      setError('Please enter your email.');
      return;
    }
    
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent. Please check your inbox.');
    } catch (e: any) {
      setError(e.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlowBackground>
      <View style={styles.container}>
        <StaggeredFadeIn index={0}>
          <GlassCard style={styles.panel} tintColor="rgba(52,211,153,0.12)">
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Secure recovery in the same softer premium system.</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {message ? <Text style={styles.success}>{message}</Text> : null}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={colors.inkMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <GlassButton label="Send Reset Link" onPress={handleReset} loading={loading} style={styles.button} />

            <View style={styles.links}>
              <Link href="/(auth)/login" style={styles.linkText}>
                Back to Login
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
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.inkMuted,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 24,
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
  success: {
    color: colors.green,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  links: {
    alignItems: 'center',
    marginTop: 24,
  },
  linkText: {
    color: colors.indigo,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
});

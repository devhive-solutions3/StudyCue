import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUserWithEmailAndPassword, updateProfile } from '@firebase/auth';
import { auth } from '../../lib/firebase';
import { PENDING_WELCOME_GREETING_KEY } from '../../lib/home-greeting';
import { useRouter, Link } from 'expo-router';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import GlassCard from '../../components/GlassCard';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import { colors } from '../../lib/theme';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();

  const handleRegister = async () => {
    setError('');
    
    // Validations
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    
    setLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      await AsyncStorage.setItem(PENDING_WELCOME_GREETING_KEY, '1');
      // Auth state listener in _layout.tsx will redirect us
    } catch (e: any) {
      setError(e.message || 'Failed to create account.');
      setLoading(false);
    }
  };

  return (
    <GlowBackground>
      <View style={styles.container}>
        <StaggeredFadeIn index={0}>
          <GlassCard style={styles.panel} tintColor="rgba(79,120,255,0.12)">
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Let AI help you stay consistent and actually get things done.</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={colors.inkMuted}
              value={name}
              onChangeText={setName}
            />
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
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor={colors.inkMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <GlassButton label="Sign Up" onPress={handleRegister} loading={loading} style={styles.button} />

            <View style={styles.links}>
              <Link href="/(auth)/login" style={styles.linkText}>
                Already have an account? Log In
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

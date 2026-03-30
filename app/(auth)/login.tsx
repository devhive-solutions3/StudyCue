import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword } from '@firebase/auth';
import { auth } from '../../lib/firebase';
import { Link } from 'expo-router';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import GlassCard from '../../components/GlassCard';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import { colors } from '../../lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadRememberedEmail = async () => {
      try {
        const [savedEmail, savedRemember] = await Promise.all([
          AsyncStorage.getItem('studycue.rememberedEmail'),
          AsyncStorage.getItem('studycue.rememberMe'),
        ]);

        const nextRememberMe = savedRemember !== 'false';
        setRememberMe(nextRememberMe);

        if (savedEmail && nextRememberMe) {
          setEmail(savedEmail);
        }
      } catch (storageError) {
        console.error('Failed to load remember me preferences', storageError);
      }
    };

    void loadRememberedEmail();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in both fields.');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      await AsyncStorage.setItem('studycue.rememberMe', String(rememberMe));
      if (rememberMe) {
        await AsyncStorage.setItem('studycue.rememberedEmail', email.trim());
      } else {
        await AsyncStorage.removeItem('studycue.rememberedEmail');
      }
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
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor={colors.inkMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={() => setShowPassword((current) => !current)}
                style={styles.eyeButton}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.inkMuted}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              accessibilityRole="checkbox"
              activeOpacity={0.85}
              onPress={() => setRememberMe((current) => !current)}
              style={styles.rememberRow}>
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>

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
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.46)',
    borderColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 14,
    paddingLeft: 16,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    color: colors.ink,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 16,
    fontSize: 16,
  },
  eyeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(16,33,59,0.18)',
    backgroundColor: 'rgba(255,255,255,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxActive: {
    backgroundColor: colors.indigo,
    borderColor: colors.indigo,
  },
  rememberText: {
    color: colors.inkMuted,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
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

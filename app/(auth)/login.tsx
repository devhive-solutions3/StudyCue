import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter, Link } from 'expo-router';

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
    <View style={styles.container}>
      <Text style={styles.title}>
        <Text style={styles.studyText}>Study</Text>
        <Text style={styles.cueText}>Cue</Text>
      </Text>
      <Text style={styles.subtitle}>Welcome back</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#94a3b8"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#94a3b8"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </TouchableOpacity>

      <View style={styles.links}>
        <Link href="/(auth)/register" asChild>
          <TouchableOpacity>
            <Text style={styles.linkText}>Create Account</Text>
          </TouchableOpacity>
        </Link>
        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity>
            <Text style={styles.linkText}>Forgot Password?</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    justifyContent: 'center',
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
    fontSize: 18,
    color: '#64748B',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    marginBottom: 48,
  },
  input: {
    backgroundColor: '#F8FAFC',
    color: '#1E293B',
    fontFamily: 'Inter_400Regular',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#22C55E',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  error: {
    color: '#ef4444',
    marginBottom: 16,
    textAlign: 'center',
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  linkText: {
    color: '#22C55E',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});

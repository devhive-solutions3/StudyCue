import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
// import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

export default function OfflineModelScreen() {
  const [downloading, setDownloading] = useState(false);
  const router = useRouter();

  const completeOnboarding = async () => {
    // In a real app we'd mark offlineModelInstalled = true in SQLite here
    const db = await SQLite.openDatabaseAsync('studycue.db');
    await db.execAsync(`UPDATE ai_preferences SET offlineModelInstalled = 1 WHERE id = 1`);
    router.replace('/(tabs)');
  };

  const skipOnboarding = () => {
    router.replace('/(tabs)');
  };

  const handleDownload = async () => {
    setDownloading(true);
    // Placeholder for actual expo-file-system download logic
    setTimeout(async () => {
      setDownloading(false);
      await completeOnboarding();
    }, 2000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Offline AI Ready</Text>
      <Text style={styles.description}>
        Cue works best with the offline Phi-3 Mini AI model. It allows you to study anywhere, even without an internet connection.
      </Text>

      <View style={{ backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 32, alignItems: 'center', borderColor: '#E2E8F0', borderWidth: 1 }}>
        <Text style={{ color: '#64748B', fontSize: 14, fontFamily: 'Inter_500Medium', marginVertical: 4 }}>Model Size: ~1.8GB</Text>
        <Text style={{ color: '#64748B', fontSize: 14, fontFamily: 'Inter_400Regular', marginVertical: 4, textAlign: 'center' }}>Connect to Wi-Fi for faster download.</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleDownload} disabled={downloading}>
        {downloading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>Download AI Pack</Text>}
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.skipButton}
        onPress={() => router.replace('/(tabs)')}
        disabled={downloading}
      >
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#64748B',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#22C55E',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  skipButton: {
    padding: 16,
  },
  skipButtonText: {
    color: '#64748B',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
// import * as FileSystem from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import GlassCard from '../../components/GlassCard';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import { colors } from '../../lib/theme';

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
    <GlowBackground>
      <View style={styles.container}>
        <StaggeredFadeIn index={0}>
          <GlassCard style={styles.panel} tintColor="rgba(124,98,255,0.12)">
            <Text style={styles.title}>Offline AI Ready</Text>
            <Text style={styles.description}>
              Cue works best with the offline Phi-3 Mini AI model. It allows you to study anywhere, even without an internet connection.
            </Text>

            <GlassCard style={styles.infoCard} tintColor="rgba(255,255,255,0.08)">
              <Text style={styles.infoTitle}>Model Size: ~1.8GB</Text>
              <Text style={styles.infoText}>Connect to Wi-Fi for faster download and a smoother first setup.</Text>
            </GlassCard>

            <GlassButton label="Download AI Pack" onPress={handleDownload} loading={downloading} style={styles.button} />
            <GlassButton label="Skip for now" onPress={skipOnboarding} variant="secondary" />
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
    alignItems: 'center',
  },
  panel: {
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: colors.inkMuted,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  infoCard: {
    marginBottom: 16,
  },
  infoTitle: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 6,
  },
  infoText: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
  button: {
    marginBottom: 12,
  },
});

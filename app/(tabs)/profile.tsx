import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter } from 'expo-router';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import GlassCard from '../../components/GlassCard';
import GlassHeader from '../../components/GlassHeader';
import { colors } from '../../lib/theme';

export default function ProfileScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Wait for auth listener to redirect
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  return (
    <GlowBackground>
      <View style={styles.container}>
        <StaggeredFadeIn index={0}>
          <GlassHeader eyebrow="Account" title="Profile" subtitle="Your preferences and study identity in a softer glass system." />
        </StaggeredFadeIn>

        <StaggeredFadeIn index={1}>
          <GlassCard style={styles.profileCard}>
            <Text style={styles.profileName}>Maria Santos</Text>
            <Text style={styles.profileMeta}>Evening study routine • Deep Work preference</Text>
          </GlassCard>
        </StaggeredFadeIn>

        <StaggeredFadeIn index={2}>
          <GlassButton label="Sign Out" onPress={handleLogout} />
        </StaggeredFadeIn>
      </View>
    </GlowBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 58,
  },
  profileCard: {
    marginBottom: 20,
  },
  profileName: {
    color: colors.ink,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  profileMeta: {
    color: colors.inkMuted,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { signOut } from '@firebase/auth';
import { auth } from '../../lib/firebase';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import GlassCard from '../../components/GlassCard';
import GlassHeader from '../../components/GlassHeader';
import { colors } from '../../lib/theme';
import {
  AppSnapshot,
  getDisplayName,
  getPendingTasks,
  loadUserAppSnapshot,
} from '../../lib/user-app-data';

const EMPTY_SNAPSHOT: AppSnapshot = {
  localUserId: null,
  displayName: null,
  email: null,
  classes: [],
  tasks: [],
  sessions: [],
};

export default function ProfileScreen() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    let isMounted = true;

    const loadSnapshot = async () => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        return;
      }

      try {
        const nextSnapshot = await loadUserAppSnapshot(firebaseUser);
        if (isMounted) {
          setSnapshot(nextSnapshot);
        }
      } catch (error) {
        console.error('Failed to load profile data', error);
      }
    };

    void loadSnapshot();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  const displayName = getDisplayName(snapshot.displayName, snapshot.email);
  const pendingTasks = getPendingTasks(snapshot.tasks).length;
  const sessionCount = snapshot.sessions.length;

  return (
    <GlowBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <StaggeredFadeIn index={0}>
          <GlassHeader eyebrow="Account" title="Profile" subtitle="Your authenticated account and local study data." />
        </StaggeredFadeIn>

        <StaggeredFadeIn index={1}>
          <GlassCard style={styles.profileCard}>
            <Text style={styles.profileName}>{displayName ?? 'Complete your profile'}</Text>
            <Text style={styles.profileMeta}>{snapshot.email ?? 'No email available'}</Text>
          </GlassCard>
        </StaggeredFadeIn>

        <StaggeredFadeIn index={2}>
          <GlassCard style={styles.profileCard} tintColor="rgba(79,120,255,0.1)">
            <Text style={styles.sectionTitle}>Your Data</Text>
            <Text style={styles.profileMeta}>Classes: {snapshot.classes.length > 0 ? String(snapshot.classes.length) : 'No classes yet'}</Text>
            <Text style={styles.profileMeta}>Tasks: {pendingTasks > 0 ? `${pendingTasks} open` : 'Add your first task'}</Text>
            <Text style={styles.profileMeta}>Sessions: {sessionCount > 0 ? String(sessionCount) : 'No study sessions yet'}</Text>
          </GlassCard>
        </StaggeredFadeIn>

        <StaggeredFadeIn index={3}>
          <GlassButton label="Sign Out" onPress={handleLogout} />
        </StaggeredFadeIn>
      </ScrollView>
    </GlowBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 58,
    paddingBottom: 120,
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
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
  },
  profileMeta: {
    color: colors.inkMuted,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
});

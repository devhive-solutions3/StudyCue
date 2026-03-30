import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { auth } from '../../lib/firebase';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import GlowBackground from '../../components/GlowBackground';
import GlassCard from '../../components/GlassCard';
import GlassHeader from '../../components/GlassHeader';
import { colors } from '../../lib/theme';
import {
  AppSnapshot,
  formatMinutes,
  getCompletedTasks,
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

type StatCard = {
  value: string;
  label: string;
  tintColor?: string;
};

export default function StatsScreen() {
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
        console.error('Failed to load stats data', error);
      }
    };

    void loadSnapshot();

    return () => {
      isMounted = false;
    };
  }, []);

  const totalFocusMinutes = snapshot.sessions.reduce((sum, session) => sum + (session.focusMinutes ?? 0), 0);
  const completedSessions = snapshot.sessions.filter((session) => session.completed).length;
  const completedTasks = getCompletedTasks(snapshot.tasks).length;

  const cards: StatCard[] = [
    {
      value: totalFocusMinutes > 0 ? formatMinutes(totalFocusMinutes) : 'No data',
      label: totalFocusMinutes > 0 ? 'Focus time logged' : 'No study sessions yet',
    },
    {
      value: completedSessions > 0 ? String(completedSessions) : 'No data',
      label: completedSessions > 0 ? 'Completed study sessions' : 'No study sessions yet',
      tintColor: 'rgba(124,98,255,0.1)',
    },
    {
      value: completedTasks > 0 ? String(completedTasks) : 'No data',
      label: completedTasks > 0 ? 'Completed tasks' : 'Add your first task',
      tintColor: 'rgba(52,211,153,0.1)',
    },
  ];

  return (
    <GlowBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <StaggeredFadeIn index={0}>
          <GlassHeader eyebrow="Insights" title="Statistics" subtitle="Your saved focus history and task progress." />
        </StaggeredFadeIn>
        {cards.map((card, index) => (
          <StaggeredFadeIn key={`${card.label}-${index}`} index={index + 1}>
            <GlassCard style={styles.card} tintColor={card.tintColor}>
              <Text style={styles.metricValue}>{card.value}</Text>
              <Text style={styles.metricLabel}>{card.label}</Text>
            </GlassCard>
          </StaggeredFadeIn>
        ))}
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
  card: {
    marginBottom: 14,
  },
  metricValue: {
    color: colors.ink,
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  metricLabel: {
    color: colors.inkMuted,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
});

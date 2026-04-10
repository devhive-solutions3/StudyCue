import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  getPendingTasks,
  loadUserAppSnapshot,
  computeStudyStreak,
} from '../../lib/user-app-data';

const EMPTY_SNAPSHOT: AppSnapshot = {
  localUserId: null,
  displayName: null,
  email: null,
  taskCategories: [],
  classes: [],
  tasks: [],
  sessions: [],
};

type StatCard = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string;
  label: string;
  tintColor: string;
};

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    let isMounted = true;

    const loadSnapshot = async () => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;

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

  const totalFocusMinutes = snapshot.sessions.reduce((sum, s) => sum + (s.focusMinutes ?? 0), 0);
  const completedSessions = snapshot.sessions.filter((s) => s.completed).length;
  const completedTasks = getCompletedTasks(snapshot.tasks).length;
  const pendingTasks = getPendingTasks(snapshot.tasks).length;
  const averageSession = completedSessions > 0 ? Math.round(totalFocusMinutes / completedSessions) : 0;
  const streak = computeStudyStreak(snapshot.sessions);

  const hasAnyData = snapshot.sessions.length > 0 || snapshot.tasks.length > 0;

  const cards: StatCard[] = [
    {
      icon: 'timer-outline',
      iconColor: colors.purple,
      value: totalFocusMinutes > 0 ? formatMinutes(totalFocusMinutes) : '0m',
      label: 'Total Focus Time',
      tintColor: 'rgba(124,98,255,0.08)',
    },
    {
      icon: 'checkmark-circle-outline',
      iconColor: colors.indigo,
      value: String(completedSessions),
      label: 'Completed Sessions',
      tintColor: 'rgba(79,120,255,0.08)',
    },
    {
      icon: 'document-text-outline',
      iconColor: colors.green,
      value: String(completedTasks),
      label: 'Tasks Completed',
      tintColor: 'rgba(52,211,153,0.08)',
    },
    {
      icon: 'analytics-outline',
      iconColor: colors.indigo,
      value: averageSession > 0 ? formatMinutes(averageSession) : '0m',
      label: 'Avg. Session Length',
      tintColor: 'rgba(79,120,255,0.06)',
    },
    {
      icon: 'flame-outline',
      iconColor: '#f59e0b',
      value: String(streak),
      label: streak === 1 ? 'Day Streak' : 'Day Streak',
      tintColor: 'rgba(245,158,11,0.08)',
    },
  ];

  const statBoardRows: [StatCard, StatCard][] = [
    [cards[1], cards[2]],
    [cards[3], cards[4]],
  ];

  return (
    <GlowBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <StaggeredFadeIn index={0}>
          <GlassHeader
            eyebrow="Insights"
            title="Statistics"
            subtitle="Your focus history and task progress."
          />
        </StaggeredFadeIn>

        {!hasAnyData ? (
          /* Empty state */
          <StaggeredFadeIn index={1}>
            <GlassCard style={styles.emptyCard} tintColor="rgba(79,120,255,0.06)">
              <View style={styles.emptyIconWrap}>
                <Ionicons name="bar-chart-outline" size={48} color={colors.indigo} />
              </View>
              <Text style={styles.emptyTitle}>No study data yet</Text>
              <Text style={styles.emptySubtitle}>
                Complete your first focus session to see your progress here.
              </Text>
            </GlassCard>
          </StaggeredFadeIn>
        ) : (
          <>
            {/* Top stat highlight */}
            <StaggeredFadeIn index={1}>
              <GlassCard style={styles.highlightCard} tintColor="rgba(124,98,255,0.1)">
                <View style={styles.highlightRow}>
                  <View style={styles.highlightIconWrap}>
                    <Ionicons name="timer" size={28} color={colors.purple} />
                  </View>
                  <View style={styles.highlightInfo}>
                    <Text style={styles.highlightValue}>
                      {totalFocusMinutes > 0 ? formatMinutes(totalFocusMinutes) : '0m'}
                    </Text>
                    <Text style={styles.highlightLabel}>Total Focus Time</Text>
                  </View>
                  {streak > 0 && (
                    <View style={styles.streakBadge}>
                      <Ionicons name="flame" size={16} color="#f59e0b" />
                      <Text style={styles.streakText}>{streak}</Text>
                    </View>
                  )}
                </View>
              </GlassCard>
            </StaggeredFadeIn>

            {/* Stat grid — single glass layer (same idea as Tasks on Home: one card, plain rows inside) */}
            <StaggeredFadeIn index={2}>
              <GlassCard
                style={styles.statsBoardCard}
                contentStyle={styles.statsBoardInner}
                tintColor="rgba(255,255,255,0.08)">
                {statBoardRows.map((pair, rowIdx) => (
                  <View
                    key={`stats-row-${rowIdx}`}
                    style={[styles.statsBoardRow, rowIdx === 0 && styles.statsBoardRowDivider]}>
                    {pair.map((card, colIdx) => (
                      <View
                        key={card.label}
                        style={[styles.statsBoardCell, colIdx === 0 && styles.statsBoardCellDivider]}>
                        <View style={[styles.statIconWrap, { backgroundColor: `${card.iconColor}18` }]}>
                          <Ionicons name={card.icon} size={20} color={card.iconColor} />
                        </View>
                        <Text style={styles.statValue}>{card.value}</Text>
                        <Text style={styles.statLabel}>{card.label}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </GlassCard>
            </StaggeredFadeIn>

            {/* Task progress summary */}
            {snapshot.tasks.length > 0 && (
              <StaggeredFadeIn index={3}>
                <GlassCard style={styles.progressCard} tintColor="rgba(52,211,153,0.06)">
                  <Text style={styles.progressTitle}>Task Progress</Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: snapshot.tasks.length > 0
                            ? `${Math.round((completedTasks / snapshot.tasks.length) * 100)}%`
                            : '0%',
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.progressMeta}>
                    <Text style={styles.progressMetaText}>
                      {completedTasks} of {snapshot.tasks.length} completed
                    </Text>
                    <Text style={styles.progressMetaText}>
                      {pendingTasks} remaining
                    </Text>
                  </View>
                </GlassCard>
              </StaggeredFadeIn>
            )}
          </>
        )}
      </ScrollView>
    </GlowBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 26,
    paddingBottom: 120,
  },
  /* Empty state */
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
    marginHorizontal: 4,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(79,120,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  /* Highlight card */
  highlightCard: {
    marginBottom: 16,
    marginHorizontal: 4,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  highlightIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(124,98,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightInfo: {
    flex: 1,
  },
  highlightValue: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
  },
  highlightLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.inkMuted,
    marginTop: 2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  streakText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#f59e0b',
  },
  /* Stats board — one GlassCard, inner grid (no nested glass tiles) */
  statsBoardCard: {
    marginBottom: 16,
    marginHorizontal: 4,
  },
  statsBoardInner: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  statsBoardRow: {
    flexDirection: 'row',
  },
  statsBoardRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.07)',
  },
  statsBoardCell: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  statsBoardCellDivider: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(0,0,0,0.07)',
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statValue: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.inkMuted,
  },
  /* Progress */
  progressCard: {
    marginBottom: 16,
    marginHorizontal: 4,
  },
  progressTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
    marginBottom: 14,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressMetaText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.inkMuted,
  },
});

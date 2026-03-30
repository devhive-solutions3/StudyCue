import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth } from '../../lib/firebase';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import GlassCard from '../../components/GlassCard';
import GlassHeader from '../../components/GlassHeader';
import { colors, radii } from '../../lib/theme';
import {
  AppSnapshot,
  buildActivityItems,
  formatDateOnly,
  formatMinutes,
  getDisplayName,
  getPendingTasks,
  getCompletedTasks,
  getTodayClasses,
  loadUserAppSnapshot,
  toggleTaskStatus,
  type TaskItem,
} from '../../lib/user-app-data';

const EMPTY_SNAPSHOT: AppSnapshot = {
  localUserId: null,
  displayName: null,
  email: null,
  classes: [],
  tasks: [],
  sessions: [],
};

export default function HomeScreen() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAPSHOT);
  const [sessionDuration, setSessionDuration] = useState<number>(25);
  const [tasksExpanded, setTasksExpanded] = useState<boolean>(false);

  const durationOptions = [
    { label: '25 min', value: 25 },
    { label: '45 min', value: 45 },
    { label: '1 hr', value: 60 },
    { label: '2 hr', value: 120 },
  ];

  useEffect(() => {
    let isMounted = true;

    const loadSnapshot = async () => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        if (isMounted) {
          setSnapshot(EMPTY_SNAPSHOT);
        }
        return;
      }

      try {
        const nextSnapshot = await loadUserAppSnapshot(firebaseUser);
        if (isMounted) {
          setSnapshot(nextSnapshot);
        }
      } catch (error) {
        console.error('Failed to load home data', error);
      }
    };

    void loadSnapshot();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleTask = useCallback(async (task: TaskItem) => {
    // Optimistic UI update
    setSnapshot(prev => {
      const nextTasks = prev.tasks.map(t => 
        t.id === task.id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
      );
      return { ...prev, tasks: nextTasks };
    });

    try {
      await toggleTaskStatus(task.id, task.status);
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        // Full refresh to ensure exact DB precision
        const fullrefresh = await loadUserAppSnapshot(firebaseUser);
        setSnapshot(fullrefresh);
      }
    } catch (e) {
      console.error('Failed to toggle task', e);
    }
  }, []);

  const displayName = getDisplayName(snapshot.displayName, snapshot.email);
  const pendingTasks = getPendingTasks(snapshot.tasks);
  const completedTasks = getCompletedTasks(snapshot.tasks);
  const todayClasses = getTodayClasses(snapshot.classes);
  const totalFocusMinutes = snapshot.sessions.reduce((sum, session) => sum + (session.focusMinutes ?? 0), 0);
  const activityItems = buildActivityItems(snapshot.tasks, snapshot.sessions);
  const nextTask = pendingTasks[0];
  const suggestionTitle = nextTask?.title?.trim() || todayClasses[0]?.title?.trim() || null;
  const suggestionBody = nextTask
    ? nextTask.dueAt
      ? `Due ${formatDateOnly(nextTask.dueAt)}. ${nextTask.estimatedMinutes ? `Estimated ${formatMinutes(nextTask.estimatedMinutes)}.` : 'Add a time estimate when you are ready.'}`
      : nextTask.estimatedMinutes
        ? `Estimated ${formatMinutes(nextTask.estimatedMinutes)}.`
        : 'This task is ready whenever you are.'
    : todayClasses[0]
      ? 'Before building a study plan, Cue will ask what subject you want to focus on and how much time you have.'
      : 'No planner suggestions yet. Add your first task or class to start a study plan.';

  const overviewCards = [
    { icon: 'book' as const, iconColor: colors.green, value: String(todayClasses.length), label: 'Classes Today' },
    { icon: 'timer' as const, iconColor: colors.indigo, value: formatMinutes(totalFocusMinutes), label: 'Focus Time' },
  ];

  const handleCuePress = () => {
    router.navigate('/(tabs)/chat');
  };

  return (
    <GlowBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StaggeredFadeIn index={0}>
          <GlassHeader
            eyebrow="StudyCue"
            title={displayName ? `Welcome back, ${displayName}` : 'Welcome back'}
            subtitle={snapshot.email ?? 'Your study data appears here once you add classes, tasks, and sessions.'}
            rightSlot={
              <View style={styles.headerBadge}>
                <Ionicons name="sparkles" size={18} color={colors.white} />
              </View>
            }
          />
        </StaggeredFadeIn>


        <StaggeredFadeIn index={2}>
          <Text style={styles.sectionTitle}>Dashboard</Text>
        </StaggeredFadeIn>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsRow}>
          {overviewCards.map((card, index) => (
            <StaggeredFadeIn key={card.label} index={index + 3}>
              <GlassCard style={styles.card} tintColor="rgba(255,255,255,0.08)">
                <View style={[styles.cardIcon, { backgroundColor: `${card.iconColor}22` }]}>
                  <Ionicons name={card.icon} size={18} color={card.iconColor} />
                </View>
                <Text style={styles.cardValue}>{card.value}</Text>
                <Text style={styles.cardLabel}>{card.label}</Text>
              </GlassCard>
            </StaggeredFadeIn>
          ))}
        </ScrollView>

        <StaggeredFadeIn index={4}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Tasks</Text>
            <Text style={styles.tasksCount}>{completedTasks.length}/{snapshot.tasks.length} done</Text>
          </View>
          <GlassCard style={styles.tasksCard} tintColor="rgba(255,255,255,0.08)">
            {snapshot.tasks.length === 0 ? (
              <Text style={styles.emptyTasksText}>No tasks yet. Ask Cue to create a to-do list for your study sessions!</Text>
            ) : (
              <View>
                {(() => {
                  const maxInitialTasks = 3;
                  const allTasks = [...pendingTasks, ...completedTasks];
                  const hasMoreTasks = allTasks.length > maxInitialTasks;
                  const visibleTasks = tasksExpanded ? allTasks : allTasks.slice(0, maxInitialTasks);

                  return (
                    <>
                      {visibleTasks.map((task, idx) => {
                        const isCompleted = task.status === 'completed';
                        const showDivider = isCompleted && idx > 0 && visibleTasks[idx - 1].status !== 'completed';

                        return (
                          <React.Fragment key={task.id}>
                            {showDivider && <View style={styles.taskDivider} />}
                            <TouchableOpacity onPress={() => handleToggleTask(task)} activeOpacity={0.7} style={[styles.taskRow, isCompleted && styles.taskRowCompleted]}>
                              <View style={isCompleted ? styles.checkboxChecked : styles.checkboxUnchecked}>
                                {isCompleted && <Ionicons name="checkmark" size={12} color={colors.white} />}
                              </View>
                              <Text style={isCompleted ? styles.taskTitleCompleted : styles.taskTitle}>{task.title || 'Untitled task'}</Text>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}

                      {hasMoreTasks && (
                        <TouchableOpacity 
                          style={styles.expandButton} 
                          onPress={() => setTasksExpanded(!tasksExpanded)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.expandButtonText}>
                            {tasksExpanded ? 'Show less' : `Show ${allTasks.length - maxInitialTasks} more`}
                          </Text>
                          <Ionicons name={tasksExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.purple} />
                        </TouchableOpacity>
                      )}
                    </>
                  );
                })()}
              </View>
            )}
          </GlassCard>
        </StaggeredFadeIn>

        <StaggeredFadeIn index={5}>
          <Text style={styles.sectionTitle}>Start a focus session</Text>
          <GlassCard style={styles.timerSetupCard} tintColor="rgba(124,98,255,0.08)">
            <Text style={styles.timerSetupHint}>Select duration</Text>
            <View style={styles.durationRow}>
              {durationOptions.map((opt) => {
                const isSelected = sessionDuration === opt.value;
                return (
                  <GlassButton
                    key={opt.value}
                    label={opt.label}
                    onPress={() => setSessionDuration(opt.value)}
                    style={[styles.durationPill, isSelected && styles.durationPillSelected]}
                    textStyle={[styles.durationPillText, isSelected && styles.durationPillTextSelected]}
                  />
                );
              })}
            </View>
            <GlassButton
              label="Start Session"
              onPress={() => {
                // Initialize timer flow here later
                console.log(`Starting session for ${sessionDuration} minutes`);
              }}
              style={styles.startButton}
            />
          </GlassCard>
        </StaggeredFadeIn>

        <StaggeredFadeIn index={7}>
          <GlassCard style={styles.timerCard} tintColor="rgba(52,211,153,0.12)">
            <View style={styles.timerTopRow}>
              <View>
                <Text style={styles.timerLabel}>Next Task</Text>
                <Text style={styles.timerValue}>{nextTask?.estimatedMinutes ? formatMinutes(nextTask.estimatedMinutes) : 'None'}</Text>
              </View>
              <View style={styles.timerChip}>
                <Text style={styles.timerChipText}>{nextTask ? 'Ready' : 'Empty'}</Text>
              </View>
            </View>
            <Text style={styles.timerHint}>{nextTask?.title?.trim() || 'Add your first task'}</Text>
          </GlassCard>
        </StaggeredFadeIn>

        <StaggeredFadeIn index={7}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </StaggeredFadeIn>

        {activityItems.length > 0 ? (
          activityItems.map((activity, index) => (
            <StaggeredFadeIn key={`${activity}-${index}`} index={index + 8}>
              <GlassCard style={styles.activityBox} tintColor="rgba(79,120,255,0.08)">
                <View style={styles.activityDot} />
                <Text style={styles.activityText}>{activity}</Text>
              </GlassCard>
            </StaggeredFadeIn>
          ))
        ) : (
          <StaggeredFadeIn index={8}>
            <GlassCard style={styles.activityBox} tintColor="rgba(79,120,255,0.08)">
              <View style={styles.activityDot} />
              <Text style={styles.activityText}>No study sessions yet</Text>
            </GlassCard>
          </StaggeredFadeIn>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </GlowBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 58,
    paddingHorizontal: 20,
  },
  headerBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tasksCount: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.purple,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tasksCard: {
    marginBottom: 24,
    paddingVertical: 8,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  taskRowCompleted: {
    opacity: 0.6,
  },
  checkboxUnchecked: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  checkboxChecked: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.ink,
    flex: 1,
  },
  taskTitleCompleted: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.inkMuted,
    textDecorationLine: 'line-through',
    flex: 1,
  },
  taskDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 4,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  expandButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.purple,
  },
  emptyTasksText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.inkMuted,
    lineHeight: 22,
    paddingVertical: 8,
  },
  cardsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  card: {
    width: 158,
    marginRight: 16,
    minHeight: 156,
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  cardValue: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    color: colors.inkMuted,
  },
  timerCard: {
    marginBottom: 24,
  },
  timerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timerLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.green,
    marginBottom: 6,
  },
  timerValue: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
  },
  timerChip: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  timerChipText: {
    color: colors.ink,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  timerHint: {
    color: colors.inkMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  timerSetupCard: {
    marginBottom: 24,
    padding: 18,
  },
  timerSetupHint: {
    color: colors.inkMuted,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    marginBottom: 12,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  durationPill: {
    minHeight: 38,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  durationPillSelected: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  durationPillText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.ink,
  },
  durationPillTextSelected: {
    color: colors.white,
  },
  startButton: {
    minHeight: 48,
  },
  activityBox: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.purple,
  },
  activityText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  bottomPad: {
    height: 120,
  },
});

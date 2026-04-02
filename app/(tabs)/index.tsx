import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { auth } from '../../lib/firebase';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import GlassCard from '../../components/GlassCard';
import GlassHeader from '../../components/GlassHeader';
import FocusSessionModal from '../../components/FocusSessionModal';
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
  recordStudySession,
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
  const [tasksExpanded, setTasksExpanded] = useState<boolean>(false);
  const [focusModalVisible, setFocusModalVisible] = useState(false);
  const [focusTask, setFocusTask] = useState<TaskItem | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(25);
  const [customDuration, setCustomDuration] = useState<string>('');

  // ─── TIMER STATE ───
  const [timerActive, setTimerActive] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timerRemainingSecs, setTimerRemainingSecs] = useState<number>(0);
  const [timerTotalSecs, setTimerTotalSecs] = useState<number>(0);
  const [timerTaskId, setTimerTaskId] = useState<number | null>(null);
  const [timerStartedAtIso, setTimerStartedAtIso] = useState<string>('');

  // Refs so the interval callback always reads the latest values (avoids stale closures)
  const timerTotalSecsRef = useRef(0);
  const timerRemainingSecsRef = useRef(0);
  const timerTaskIdRef = useRef<number | null>(null);
  const timerStartedAtIsoRef = useRef('');
  const sessionEndingRef = useRef(false); // prevent double-fire

  const durationOptions = [
    { label: '25 min', value: 25 },
    { label: '45 min', value: 45 },
    { label: '1 hr', value: 60 },
    { label: '2 hr', value: 120 },
  ];

  useFocusEffect(
    useCallback(() => {
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
    }, [])
  );

  // ─── TIMER LOGIC ───
  // Keep refs in sync with state so the interval always sees fresh values
  useEffect(() => { timerTotalSecsRef.current = timerTotalSecs; }, [timerTotalSecs]);
  useEffect(() => { timerRemainingSecsRef.current = timerRemainingSecs; }, [timerRemainingSecs]);
  useEffect(() => { timerTaskIdRef.current = timerTaskId; }, [timerTaskId]);
  useEffect(() => { timerStartedAtIsoRef.current = timerStartedAtIso; }, [timerStartedAtIso]);

  const handleEndSession = useCallback(async (completedNaturally: boolean) => {
    if (sessionEndingRef.current) return; // guard against double-fire
    sessionEndingRef.current = true;

    setTimerActive(false);
    setTimerPaused(false);

    // Use refs to get accurate values regardless of stale closures
    const totalSecs = timerTotalSecsRef.current;
    const remainingSecs = completedNaturally ? 0 : timerRemainingSecsRef.current;
    const actualSeconds = totalSecs - remainingSecs;
    const actualMinutes = Math.max(1, Math.round(actualSeconds / 60));
    const taskId = timerTaskIdRef.current;
    const startedAt = timerStartedAtIsoRef.current;

    const firebaseUser = auth.currentUser;
    if (firebaseUser && actualMinutes > 0) {
      try {
        await recordStudySession(firebaseUser, {
          taskId,
          startedAt,
          endedAt: new Date().toISOString(),
          focusMinutes: actualMinutes,
          completed: completedNaturally,
        });

        // Auto-complete the linked task when timer finishes naturally
        if (completedNaturally && taskId !== null) {
          await toggleTaskStatus(taskId, 'pending'); // mark as completed
        }

        // Refresh dashboard so Focus Time, Recent Activity and task list update
        const freshSnapshot = await loadUserAppSnapshot(firebaseUser);
        setSnapshot(freshSnapshot);
      } catch (e) {
        console.error('Failed to log session', e);
      }
    }

    sessionEndingRef.current = false;
  }, []);

  useEffect(() => {
    if (!timerActive || timerPaused || !timerEndsAt) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const left = Math.ceil((timerEndsAt - now) / 1000);

      if (left <= 0) {
        setTimerRemainingSecs(0);
        timerRemainingSecsRef.current = 0;
        void handleEndSession(true); // Completed naturally
      } else {
        setTimerRemainingSecs(left);
        timerRemainingSecsRef.current = left;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timerActive, timerPaused, timerEndsAt, handleEndSession]);

  const handleStartSession = useCallback((durationMinutes: number, task: TaskItem | null = null) => {
    setFocusModalVisible(false);
    sessionEndingRef.current = false;

    const durationSecs = durationMinutes * 60;
    timerTotalSecsRef.current = durationSecs;
    timerRemainingSecsRef.current = durationSecs;
    timerTaskIdRef.current = task?.id ?? null;
    timerStartedAtIsoRef.current = new Date().toISOString();

    setTimerTotalSecs(durationSecs);
    setTimerRemainingSecs(durationSecs);
    setTimerEndsAt(Date.now() + durationSecs * 1000);
    setTimerTaskId(task?.id ?? null);
    setTimerStartedAtIso(timerStartedAtIsoRef.current);
    setTimerPaused(false);
    setTimerActive(true);
  }, []);

  const handlePauseResume = useCallback(() => {
    if (timerPaused) {
      // Resuming: Push the end time forward by the remaining time
      setTimerEndsAt(Date.now() + timerRemainingSecsRef.current * 1000);
      setTimerPaused(false);
    } else {
      // Pausing
      setTimerPaused(true);
      setTimerEndsAt(null);
    }
  }, [timerPaused]);

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
        const fullrefresh = await loadUserAppSnapshot(firebaseUser);
        setSnapshot(fullrefresh);
      }
    } catch (e) {
      console.error('Failed to toggle task', e);
    }
  }, []);

  const handleOpenFocusModal = useCallback((task: TaskItem | null) => {
    setFocusTask(task);
    setFocusModalVisible(true);
  }, []);

  const displayName = getDisplayName(snapshot.displayName, snapshot.email);
  const pendingTasks = getPendingTasks(snapshot.tasks);
  const completedTasks = getCompletedTasks(snapshot.tasks);
  const todayClasses = getTodayClasses(snapshot.classes);
  const totalFocusMinutes = snapshot.sessions.reduce((sum, session) => sum + (session.focusMinutes ?? 0), 0);
  const activityItems = buildActivityItems(snapshot.tasks, snapshot.sessions);
  const nextTask = pendingTasks[0];

  // Build contextual subtitle (no email)
  const subtitleText = pendingTasks.length > 0
    ? `You have ${pendingTasks.length} pending task${pendingTasks.length === 1 ? '' : 's'}`
    : 'All caught up! Add tasks to get started.';

  const overviewCards = [
    { icon: 'book' as const, iconColor: colors.green, value: String(todayClasses.length), label: 'Classes Today' },
    { icon: 'timer' as const, iconColor: colors.indigo, value: formatMinutes(totalFocusMinutes), label: 'Focus Time' },
    { icon: 'checkmark-done' as const, iconColor: colors.purple, value: String(completedTasks.length), label: 'Tasks Done' },
  ];

  return (
    <GlowBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StaggeredFadeIn index={0}>
          <GlassHeader
            eyebrow="StudyCue"
            title={displayName ? `Welcome back, ${displayName}` : 'Welcome back'}
            subtitle={subtitleText}
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
                            <View style={[styles.taskRow, isCompleted && styles.taskRowCompleted]}>
                              <TouchableOpacity onPress={() => handleToggleTask(task)} activeOpacity={0.7} style={styles.checkboxHitArea}>
                                <View style={isCompleted ? styles.checkboxChecked : styles.checkboxUnchecked}>
                                  {isCompleted && <Ionicons name="checkmark" size={12} color={colors.white} />}
                                </View>
                              </TouchableOpacity>
                              <Text style={isCompleted ? styles.taskTitleCompleted : styles.taskTitle}>{task.title || 'Untitled task'}</Text>
                              {!isCompleted && (
                                <TouchableOpacity
                                  onPress={() => handleOpenFocusModal(task)}
                                  activeOpacity={0.7}
                                  style={styles.readyPill}
                                >
                                  <Ionicons name="play" size={10} color={colors.purple} />
                                  <Text style={styles.readyPillText}>Ready</Text>
                                </TouchableOpacity>
                              )}
                            </View>
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

        {/* Next Task Card — interactive "Ready" */}
        <StaggeredFadeIn index={5}>
          <GlassCard style={styles.timerCard} tintColor="rgba(52,211,153,0.12)">
            <View style={styles.timerTopRow}>
              <View>
                <Text style={styles.timerLabel}>Next Task</Text>
                <Text style={styles.timerValue}>{nextTask?.estimatedMinutes ? formatMinutes(nextTask.estimatedMinutes) : 'None'}</Text>
              </View>
              {nextTask ? (
                <TouchableOpacity
                  onPress={() => handleOpenFocusModal(nextTask)}
                  activeOpacity={0.7}
                  style={styles.readyChip}
                >
                  <Ionicons name="play-circle" size={16} color={colors.purple} />
                  <Text style={styles.readyChipText}>Ready</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.emptyChip}>
                  <Text style={styles.emptyChipText}>Empty</Text>
                </View>
              )}
            </View>
            <Text style={styles.timerHint}>{nextTask?.title?.trim() || 'Add your first task'}</Text>
          </GlassCard>
        </StaggeredFadeIn>

        {/* Start a focus session OR Active Timer */}
        <StaggeredFadeIn index={6}>
          {timerActive ? (
            <View>
              <Text style={styles.sectionTitle}>Active Focus Session</Text>
              <GlassCard style={styles.timerActiveCard} tintColor="rgba(124,98,255,0.12)">
                <Text style={styles.timerActiveHint}>
                  {timerPaused ? "Paused" : "Stay Focused"}
                </Text>
                
                <Text style={styles.timerHugeText}>
                  {String(Math.floor(timerRemainingSecs / 60)).padStart(2, '0')}:
                  {String(timerRemainingSecs % 60).padStart(2, '0')}
                </Text>

                <View style={styles.timerControls}>
                  <GlassButton
                    label={timerPaused ? "Resume" : "Pause"}
                    onPress={handlePauseResume}
                    style={styles.timerSecondaryBtn}
                    textStyle={styles.timerSecondaryBtnText}
                  />
                  <GlassButton
                    label="End Session"
                    onPress={() => handleEndSession(false)}
                    style={styles.timerDangerBtn}
                  />
                </View>
              </GlassCard>
            </View>
          ) : (
            <View>
              <Text style={styles.sectionTitle}>Start a focus session</Text>
              <GlassCard style={styles.focusSetupCard} tintColor="rgba(124,98,255,0.08)">
                <Text style={styles.focusSetupHint}>Select duration</Text>
                <View style={styles.durationRow}>
                  {durationOptions.map((opt) => {
                    const isSelected = sessionDuration === opt.value && customDuration === '';
                    return (
                      <GlassButton
                        key={opt.value}
                        label={opt.label}
                        onPress={() => {
                          setSessionDuration(opt.value);
                          setCustomDuration('');
                        }}
                        style={[styles.durationPill, isSelected && styles.durationPillSelected]}
                        textStyle={[styles.durationPillText, isSelected && styles.durationPillTextSelected]}
                      />
                    );
                  })}
                </View>
                <Text style={styles.focusSetupHint}>Or enter custom minutes</Text>
                <TextInput
                  style={styles.customInput}
                  value={customDuration}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    setCustomDuration(cleaned);
                    if (cleaned) {
                      setSessionDuration(Number(cleaned));
                    }
                  }}
                  placeholder="e.g. 35"
                  placeholderTextColor="rgba(0,0,0,0.25)"
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <GlassButton
                  label="Start Session"
                  onPress={() => {
                    const finalDuration = customDuration ? Number(customDuration) : sessionDuration;
                    handleStartSession(finalDuration);
                  }}
                  style={styles.startButton}
                />
              </GlassCard>
            </View>
          )}
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

      <FocusSessionModal
        visible={focusModalVisible}
        task={focusTask}
        onClose={() => setFocusModalVisible(false)}
        onStart={handleStartSession}
      />
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
    paddingVertical: 10,
    gap: 10,
  },
  taskRowCompleted: {
    opacity: 0.6,
  },
  checkboxHitArea: {
    padding: 4,
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
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(124,98,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124,98,255,0.2)',
  },
  readyPillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.purple,
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
    width: 148,
    marginRight: 14,
    minHeight: 148,
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
  readyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(124,98,255,0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(124,98,255,0.2)',
  },
  readyChipText: {
    color: colors.purple,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  emptyChip: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyChipText: {
    color: colors.inkMuted,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  timerHint: {
    color: colors.inkMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
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
  focusSetupCard: {
    marginBottom: 24,
    padding: 18,
  },
  focusSetupHint: {
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
  customInput: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: colors.ink,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    marginBottom: 20,
  },
  startButton: {
    minHeight: 48,
  },
  bottomPad: {
    height: 130, // Pad for tab bar
  },
  timerActiveCard: {
    marginBottom: 28,
    alignItems: 'center',
    paddingVertical: 32,
  },
  timerActiveHint: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.purple,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  timerHugeText: {
    fontSize: 64,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
    marginBottom: 24,
    fontVariant: ['tabular-nums'],
  },
  timerControls: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  timerSecondaryBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderColor: 'rgba(255,255,255,0.8)',
  },
  timerSecondaryBtnText: {
    color: colors.ink,
  },
  timerDangerBtn: {
    flex: 1,
    backgroundColor: colors.danger,
    borderColor: 'transparent',
  },
});

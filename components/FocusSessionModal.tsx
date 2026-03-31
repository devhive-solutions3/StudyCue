import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from './GlassCard';
import GlassButton from './GlassButton';
import { colors, radii } from '../lib/theme';
import { type TaskItem, formatMinutes } from '../lib/user-app-data';

type FocusSessionModalProps = {
  visible: boolean;
  task: TaskItem | null;
  onClose: () => void;
  onStart: (durationMinutes: number, task: TaskItem | null) => void;
};

const PRESET_DURATIONS = [15, 25, 45, 60];

export default function FocusSessionModal({
  visible,
  task,
  onClose,
  onStart,
}: FocusSessionModalProps) {
  const suggestedDuration = task?.estimatedMinutes ?? 25;
  const [selectedDuration, setSelectedDuration] = useState(suggestedDuration);

  useEffect(() => {
    if (visible) {
      setSelectedDuration(task?.estimatedMinutes ?? 25);
    }
  }, [visible, task]);

  // Build the list of durations, inserting the task estimate if it's not a preset
  const durations = PRESET_DURATIONS.includes(suggestedDuration)
    ? PRESET_DURATIONS
    : [...PRESET_DURATIONS, suggestedDuration].sort((a, b) => a - b);

  const formatDurationLabel = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes === 60) return '1 hr';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h} hr`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="timer-outline" size={22} color={colors.purple} />
            </View>
            <Text style={styles.headerTitle}>Start Focus Session</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>

          {/* Task info */}
          {task && (
            <GlassCard style={styles.taskCard} tintColor="rgba(124,98,255,0.06)">
              <Text style={styles.taskLabel}>TASK</Text>
              <Text style={styles.taskName}>{task.title || 'Untitled task'}</Text>
              {task.estimatedMinutes ? (
                <Text style={styles.taskMeta}>
                  Estimated: {formatMinutes(task.estimatedMinutes)}
                </Text>
              ) : null}
            </GlassCard>
          )}

          {/* Duration picker */}
          <Text style={styles.sectionLabel}>Select Duration</Text>
          <View style={styles.durationRow}>
            {durations.map((dur) => {
              const isSelected = selectedDuration === dur;
              const isTaskEstimate = dur === task?.estimatedMinutes && !PRESET_DURATIONS.includes(dur);
              return (
                <TouchableOpacity
                  key={dur}
                  onPress={() => setSelectedDuration(dur)}
                  activeOpacity={0.7}
                  style={[
                    styles.durationPill,
                    isSelected && styles.durationPillSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.durationPillText,
                      isSelected && styles.durationPillTextSelected,
                    ]}
                  >
                    {formatDurationLabel(dur)}
                  </Text>
                  {isTaskEstimate && (
                    <Text
                      style={[
                        styles.durationPillSub,
                        isSelected && styles.durationPillSubSelected,
                      ]}
                    >
                      suggested
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Summary */}
          <View style={styles.summaryRow}>
            <Ionicons name="time-outline" size={18} color={colors.purple} />
            <Text style={styles.summaryText}>
              {formatDurationLabel(selectedDuration)} focus session
            </Text>
          </View>

          {/* Actions */}
          <GlassButton
            label="Start Session"
            onPress={() => onStart(selectedDuration, task)}
          />
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.pageTop,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(124,98,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCard: {
    marginBottom: 20,
  },
  taskLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.purple,
    marginBottom: 6,
  },
  taskName: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: colors.ink,
    marginBottom: 4,
  },
  taskMeta: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.inkMuted,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.inkMuted,
    marginBottom: 12,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  durationPill: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
  },
  durationPillSelected: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  durationPillText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.ink,
  },
  durationPillTextSelected: {
    color: colors.white,
  },
  durationPillSub: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: colors.inkMuted,
    marginTop: 2,
  },
  durationPillSubSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(124,98,255,0.06)',
    borderRadius: radii.xl,
  },
  summaryText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.ink,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.inkMuted,
  },
});

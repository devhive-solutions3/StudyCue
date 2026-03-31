import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from '@firebase/auth';
import { auth } from '../../lib/firebase';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import GlassCard from '../../components/GlassCard';
import GlassHeader from '../../components/GlassHeader';
import { colors, radii } from '../../lib/theme';
import {
  AppSnapshot,
  UserPreferences,
  getDisplayName,
  getPendingTasks,
  loadUserAppSnapshot,
  loadUserPreferences,
  updateUserProfile,
} from '../../lib/user-app-data';

const EMPTY_SNAPSHOT: AppSnapshot = {
  localUserId: null,
  displayName: null,
  email: null,
  classes: [],
  tasks: [],
  sessions: [],
};

const FOCUS_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '25 min', value: 25 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

const GOAL_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
  { label: '1.5 hr', value: 90 },
  { label: '2 hr', value: 120 },
];

export default function ProfileScreen() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAPSHOT);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editFocus, setEditFocus] = useState(25);
  const [editGoal, setEditGoal] = useState(120);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;

      try {
        const nextSnapshot = await loadUserAppSnapshot(firebaseUser);
        if (isMounted) {
          setSnapshot(nextSnapshot);
          setEditName(nextSnapshot.displayName ?? '');
        }

        if (nextSnapshot.localUserId) {
          const prefs = await loadUserPreferences(nextSnapshot.localUserId);
          if (isMounted) {
            setPreferences(prefs);
            setEditFocus(prefs.preferredFocusMinutes);
            setEditGoal(prefs.dailyGoalMinutes);
          }
        }
      } catch (error) {
        console.error('Failed to load profile data', error);
      }
    };

    void loadData();

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

  const handleStartEditing = useCallback(() => {
    setEditName(snapshot.displayName ?? '');
    setEditFocus(preferences?.preferredFocusMinutes ?? 25);
    setEditGoal(preferences?.dailyGoalMinutes ?? 120);
    setEditing(true);
  }, [snapshot, preferences]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    setSaving(true);
    try {
      await updateUserProfile(firebaseUser, {
        displayName: editName.trim() || undefined,
        preferredFocusMinutes: editFocus,
        dailyGoalMinutes: editGoal,
      });

      // Refresh data
      const nextSnapshot = await loadUserAppSnapshot(firebaseUser);
      setSnapshot(nextSnapshot);

      if (nextSnapshot.localUserId) {
        const prefs = await loadUserPreferences(nextSnapshot.localUserId);
        setPreferences(prefs);
      }

      setEditing(false);
    } catch (e) {
      console.error('Failed to save profile', e);
    } finally {
      setSaving(false);
    }
  }, [editName, editFocus, editGoal]);

  const displayName = getDisplayName(snapshot.displayName, snapshot.email);
  const pendingTasks = getPendingTasks(snapshot.tasks).length;
  const sessionCount = snapshot.sessions.length;

  const uniqueClassesCount = new Set(
    snapshot.classes
      .filter((c) => c.eventType === 'class')
      .map((c) => (c.title || '').trim().toLowerCase())
      .filter((title) => title.length > 0)
  ).size;

  // Generate initials for avatar
  const initials = (displayName ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <GlowBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <StaggeredFadeIn index={0}>
          <GlassHeader
            eyebrow="Account"
            title="Profile"
            subtitle="Manage your account and study preferences."
          />
        </StaggeredFadeIn>

        {/* Avatar + Identity Card */}
        <StaggeredFadeIn index={1}>
          <GlassCard style={styles.identityCard}>
            <View style={styles.identityRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.identityInfo}>
                <Text style={styles.profileName}>{displayName ?? 'Complete your profile'}</Text>
                <Text style={styles.profileEmail}>{snapshot.email ?? 'No email available'}</Text>
              </View>
            </View>
            {!editing && (
              <TouchableOpacity onPress={handleStartEditing} activeOpacity={0.7} style={styles.editButton}>
                <Ionicons name="pencil-outline" size={16} color={colors.purple} />
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
            )}
          </GlassCard>
        </StaggeredFadeIn>

        {/* Edit Mode */}
        {editing && (
          <StaggeredFadeIn index={1}>
            <GlassCard style={styles.editCard} tintColor="rgba(124,98,255,0.06)">
              <Text style={styles.editSectionTitle}>Edit Profile</Text>

              <Text style={styles.fieldLabel}>Display Name</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your name"
                placeholderTextColor="rgba(0,0,0,0.25)"
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>{snapshot.email ?? 'Not set'}</Text>
                <Ionicons name="lock-closed-outline" size={14} color={colors.inkMuted} />
              </View>

              <Text style={styles.fieldLabel}>Preferred Focus Duration</Text>
              <View style={styles.pillRow}>
                {FOCUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setEditFocus(opt.value)}
                    activeOpacity={0.7}
                    style={[styles.optionPill, editFocus === opt.value && styles.optionPillSelected]}
                  >
                    <Text style={[styles.optionPillText, editFocus === opt.value && styles.optionPillTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Daily Study Goal</Text>
              <View style={styles.pillRow}>
                {GOAL_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setEditGoal(opt.value)}
                    activeOpacity={0.7}
                    style={[styles.optionPill, editGoal === opt.value && styles.optionPillSelected]}
                  >
                    <Text style={[styles.optionPillText, editGoal === opt.value && styles.optionPillTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.editActions}>
                <GlassButton label="Save Changes" onPress={handleSave} loading={saving} style={styles.saveButton} />
                <TouchableOpacity onPress={handleCancelEdit} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          </StaggeredFadeIn>
        )}

        {/* Data Summary */}
        <StaggeredFadeIn index={2}>
          <GlassCard style={styles.dataCard} tintColor="rgba(79,120,255,0.08)">
            <Text style={styles.dataSectionTitle}>Your Data</Text>
            <View style={styles.dataRow}>
              <View style={styles.dataIconWrap}>
                <Ionicons name="book-outline" size={16} color={colors.green} />
              </View>
              <Text style={styles.dataLabel}>Classes</Text>
              <Text style={styles.dataValue}>{uniqueClassesCount > 0 ? String(uniqueClassesCount) : '—'}</Text>
            </View>
            <View style={styles.dataRow}>
              <View style={styles.dataIconWrap}>
                <Ionicons name="list-outline" size={16} color={colors.purple} />
              </View>
              <Text style={styles.dataLabel}>Pending Tasks</Text>
              <Text style={styles.dataValue}>{pendingTasks > 0 ? String(pendingTasks) : '—'}</Text>
            </View>
            <View style={styles.dataRow}>
              <View style={styles.dataIconWrap}>
                <Ionicons name="timer-outline" size={16} color={colors.indigo} />
              </View>
              <Text style={styles.dataLabel}>Study Sessions</Text>
              <Text style={styles.dataValue}>{sessionCount > 0 ? String(sessionCount) : '—'}</Text>
            </View>
          </GlassCard>
        </StaggeredFadeIn>

        {/* Study Preferences Summary */}
        {preferences && !editing && (
          <StaggeredFadeIn index={3}>
            <GlassCard style={styles.dataCard} tintColor="rgba(52,211,153,0.08)">
              <Text style={styles.dataSectionTitle}>Study Preferences</Text>
              <View style={styles.dataRow}>
                <View style={styles.dataIconWrap}>
                  <Ionicons name="hourglass-outline" size={16} color={colors.purple} />
                </View>
                <Text style={styles.dataLabel}>Focus Duration</Text>
                <Text style={styles.dataValue}>{preferences.preferredFocusMinutes} min</Text>
              </View>
              <View style={styles.dataRow}>
                <View style={styles.dataIconWrap}>
                  <Ionicons name="flag-outline" size={16} color={colors.green} />
                </View>
                <Text style={styles.dataLabel}>Daily Goal</Text>
                <Text style={styles.dataValue}>{preferences.dailyGoalMinutes} min</Text>
              </View>
            </GlassCard>
          </StaggeredFadeIn>
        )}

        <StaggeredFadeIn index={4}>
          <GlassButton label="Sign Out" onPress={handleLogout} variant="secondary" style={styles.signOutButton} />
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
  identityCard: {
    marginBottom: 20,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.white,
  },
  identityInfo: {
    flex: 1,
  },
  profileName: {
    color: colors.ink,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  profileEmail: {
    color: colors.inkMuted,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(124,98,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124,98,255,0.2)',
  },
  editButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.purple,
  },
  editCard: {
    marginBottom: 20,
  },
  editSectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 14,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: colors.ink,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  readOnlyText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: colors.inkMuted,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  optionPillSelected: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  optionPillText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.ink,
  },
  optionPillTextSelected: {
    color: colors.white,
  },
  editActions: {
    marginTop: 24,
  },
  saveButton: {
    marginBottom: 8,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.inkMuted,
  },
  dataCard: {
    marginBottom: 16,
  },
  dataSectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
    marginBottom: 14,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  dataIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.ink,
  },
  dataValue: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.inkMuted,
  },
  signOutButton: {
    marginTop: 8,
  },
});

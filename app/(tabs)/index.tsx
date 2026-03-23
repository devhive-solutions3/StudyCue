import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import GlassCard from '../../components/GlassCard';
import GlassHeader from '../../components/GlassHeader';
import { colors, radii } from '../../lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const overviewCards = [
    { icon: 'book', iconColor: colors.green, value: '2', label: 'Classes Today' },
    { icon: 'sparkles', iconColor: colors.purple, value: '92%', label: 'Focus Score' },
    { icon: 'timer', iconColor: colors.indigo, value: '45m', label: 'Next Focus Block' },
  ] as const;
  const activityItems = [
    'You completed 45 mins of Physics review.',
    'Your Calculus quiz is 2 days away.',
    'Cue suggests a 30-minute Biology recap tonight.',
  ];

  const handleCuePress = () => {
    // Navigate to Chat tab or show quick suggestion
    router.navigate('/(tabs)/chat');
  };

  return (
    <GlowBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <StaggeredFadeIn index={0}>
          <GlassHeader
            eyebrow="StudyCue"
            title="Good evening, Maria"
            subtitle="Wednesday, October 25 • Your calm AI planner for tonight's study sprint."
            rightSlot={
              <View style={styles.headerBadge}>
                <Ionicons name="sparkles" size={18} color={colors.white} />
              </View>
            }
          />
        </StaggeredFadeIn>

        <StaggeredFadeIn index={1}>
          <GlassCard style={styles.heroCard} tintColor="rgba(124,98,255,0.14)">
            <View style={styles.heroGlow} />
            <Text style={styles.heroEyebrow}>AI Suggestion</Text>
            <Text style={styles.heroTitle}>Start with a 45-minute Physics recall block.</Text>
            <Text style={styles.heroBody}>
              You have the highest urgency there, and your energy trend says you’re still in a strong focus window.
            </Text>
            <GlassButton label="What should I do now?" onPress={handleCuePress} style={styles.heroButton} />
          </GlassCard>
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

        <StaggeredFadeIn index={6}>
          <GlassCard style={styles.timerCard} tintColor="rgba(52,211,153,0.12)">
            <View style={styles.timerTopRow}>
              <View>
                <Text style={styles.timerLabel}>Deep Work Timer</Text>
                <Text style={styles.timerValue}>24:18</Text>
              </View>
              <View style={styles.timerChip}>
                <Text style={styles.timerChipText}>Focus</Text>
              </View>
            </View>
            <Text style={styles.timerHint}>Stay on chapter 6 derivations for one uninterrupted session.</Text>
          </GlassCard>
        </StaggeredFadeIn>

        <StaggeredFadeIn index={7}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </StaggeredFadeIn>

        {activityItems.map((activity, index) => (
          <StaggeredFadeIn key={activity} index={index + 8}>
            <GlassCard style={styles.activityBox} tintColor="rgba(79,120,255,0.08)">
              <View style={styles.activityDot} />
              <Text style={styles.activityText}>{activity}</Text>
            </GlassCard>
          </StaggeredFadeIn>
        ))}

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
  heroCard: {
    marginBottom: 24,
    minHeight: 220,
  },
  heroGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(124,98,255,0.2)',
  },
  heroEyebrow: {
    color: colors.indigo,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
    marginBottom: 10,
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: 'Inter_400Regular',
    color: colors.inkMuted,
    marginBottom: 20,
  },
  heroButton: {
    marginTop: 'auto',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
    marginBottom: 16,
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

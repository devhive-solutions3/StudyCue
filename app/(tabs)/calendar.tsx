import { View, Text, StyleSheet } from 'react-native';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import GlowBackground from '../../components/GlowBackground';
import GlassCard from '../../components/GlassCard';
import GlassHeader from '../../components/GlassHeader';
import { colors } from '../../lib/theme';

export default function CalendarScreen() {
  return (
    <GlowBackground>
      <View style={styles.container}>
        <StaggeredFadeIn index={0}>
          <GlassHeader eyebrow="Planner" title="Calendar" subtitle="Layered schedule surfaces with readable daily context." />
        </StaggeredFadeIn>
        <StaggeredFadeIn index={1}>
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>Today</Text>
            <Text style={styles.cardBody}>No classes scheduled this evening. Best slot for a long review block starts at 7:30 PM.</Text>
          </GlassCard>
        </StaggeredFadeIn>
        <StaggeredFadeIn index={2}>
          <GlassCard style={styles.card} tintColor="rgba(79,120,255,0.1)">
            <Text style={styles.cardTitle}>Next Up</Text>
            <Text style={styles.cardBody}>Physics lecture at 8:00 AM tomorrow, followed by a short calculus practice window.</Text>
          </GlassCard>
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
  card: {
    marginBottom: 14,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  cardBody: {
    color: colors.inkMuted,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
});

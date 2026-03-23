import { View, Text, StyleSheet } from 'react-native';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import GlowBackground from '../../components/GlowBackground';
import GlassCard from '../../components/GlassCard';
import GlassHeader from '../../components/GlassHeader';
import { colors } from '../../lib/theme';

export default function StatsScreen() {
  return (
    <GlowBackground>
      <View style={styles.container}>
        <StaggeredFadeIn index={0}>
          <GlassHeader eyebrow="Insights" title="Statistics" subtitle="Clear, readable progress with premium glass surfaces." />
        </StaggeredFadeIn>
        <StaggeredFadeIn index={1}>
          <GlassCard style={styles.card}>
            <Text style={styles.metricValue}>8.5h</Text>
            <Text style={styles.metricLabel}>Focus time this week</Text>
          </GlassCard>
        </StaggeredFadeIn>
        <StaggeredFadeIn index={2}>
          <GlassCard style={styles.card} tintColor="rgba(124,98,255,0.1)">
            <Text style={styles.metricValue}>6</Text>
            <Text style={styles.metricLabel}>Completed study sessions</Text>
          </GlassCard>
        </StaggeredFadeIn>
        <StaggeredFadeIn index={3}>
          <GlassCard style={styles.card} tintColor="rgba(52,211,153,0.1)">
            <Text style={styles.metricValue}>73%</Text>
            <Text style={styles.metricLabel}>Planner consistency score</Text>
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

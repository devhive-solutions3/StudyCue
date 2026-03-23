import { View, Text, StyleSheet } from 'react-native';
import StaggeredFadeIn from '../../components/StaggeredFadeIn';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import GlassCard from '../../components/GlassCard';
import GlassHeader from '../../components/GlassHeader';
import { colors } from '../../lib/theme';

export default function ChatScreen() {
  return (
    <GlowBackground>
      <View style={styles.container}>
        <StaggeredFadeIn index={0}>
          <GlassHeader
            eyebrow="Cue"
            title="AI Study Planner"
            subtitle="Ask for a next step, a revision sequence, or a calm daily plan."
          />
        </StaggeredFadeIn>
        <StaggeredFadeIn index={1}>
          <GlassCard style={styles.messageCard} tintColor="rgba(124,98,255,0.12)">
            <Text style={styles.messageLabel}>Suggested Prompt</Text>
            <Text style={styles.messageText}>Build me a 2-hour study flow for Physics and Calculus with one short break.</Text>
          </GlassCard>
        </StaggeredFadeIn>
        <StaggeredFadeIn index={2}>
          <GlassCard style={styles.messageCard} tintColor="rgba(52,211,153,0.12)">
            <Text style={styles.messageLabel}>Cue</Text>
            <Text style={styles.messageText}>I’d start with Physics problem recall while your focus is high, then switch into lighter Calculus practice.</Text>
          </GlassCard>
        </StaggeredFadeIn>
        <StaggeredFadeIn index={3}>
          <GlassCard style={styles.inputShell} tintColor="rgba(255,255,255,0.1)">
            <Text style={styles.inputText}>Ask Cue anything about your study plan...</Text>
            <GlassButton label="Open Composer" onPress={() => {}} variant="secondary" style={styles.composerButton} />
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
  messageCard: {
    marginBottom: 16,
  },
  messageLabel: {
    color: colors.indigo,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  messageText: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    lineHeight: 24,
  },
  inputShell: {
  },
  inputText: {
    color: colors.inkMuted,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
  },
  composerButton: {
    marginTop: 4,
  },
});

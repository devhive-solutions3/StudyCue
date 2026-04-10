import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import GlassCard from './GlassCard';
import { colors } from '../lib/theme';

type GlassHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
};

export default function GlassHeader({ eyebrow, title, subtitle, rightSlot }: GlassHeaderProps) {
  return (
    <GlassCard style={styles.outer} contentStyle={styles.inner} tintColor="rgba(255,255,255,0.08)">
      <View style={styles.row}>
        <View style={styles.copy}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {rightSlot ? <View>{rightSlot}</View> : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginBottom: 18,
    marginHorizontal: 4,
  },
  inner: {
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  copy: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.indigo,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: 'Inter_700Bold',
    color: colors.ink,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    color: colors.inkMuted,
  },
});

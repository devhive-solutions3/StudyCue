import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';

type GlowBackgroundProps = {
  children: React.ReactNode;
};

export default function GlowBackground({ children }: GlowBackgroundProps) {
  return (
    <View style={styles.page}>
      <View style={[styles.glow, styles.glowPurple]} />
      <View style={[styles.glow, styles.glowBlue]} />
      <View style={[styles.glow, styles.glowGreen]} />
      <View style={styles.noiseVeil} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageTop,
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.9,
  },
  glowPurple: {
    top: -60,
    right: -40,
    width: 260,
    height: 260,
    backgroundColor: 'rgba(124, 98, 255, 0.24)',
  },
  glowBlue: {
    top: 180,
    left: -80,
    width: 240,
    height: 240,
    backgroundColor: 'rgba(79, 120, 255, 0.18)',
  },
  glowGreen: {
    bottom: 120,
    right: -70,
    width: 220,
    height: 220,
    backgroundColor: 'rgba(52, 211, 153, 0.18)',
  },
  noiseVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});

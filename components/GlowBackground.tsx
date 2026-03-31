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
    borderRadius: 9999, // ensures it's perfectly round even when massive
  },
  glowPurple: {
    top: -300,
    right: -350,
    width: 700,
    height: 700,
    backgroundColor: 'rgba(124, 98, 255, 0.12)', // ambient, softer
  },
  glowBlue: {
    top: 150,
    left: -350,
    width: 650,
    height: 650,
    backgroundColor: 'rgba(79, 120, 255, 0.10)',
  },
  glowGreen: {
    bottom: -150,
    right: -250,
    width: 600,
    height: 600,
    backgroundColor: 'rgba(52, 211, 153, 0.10)',
  },
  noiseVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.45)', // increased opacity to soften shapes further
  },
});

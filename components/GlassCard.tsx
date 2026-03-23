import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { colors, radii, shadows } from '../lib/theme';

type GlassCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  tintColor?: string;
};

export default function GlassCard({
  children,
  style,
  contentStyle,
  tintColor = 'rgba(255,255,255,0.12)',
}: GlassCardProps) {
  const glassAvailable = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

  return (
    <View style={[styles.shell, style]}>
      {glassAvailable ? (
        <GlassView
          glassEffectStyle="regular"
          colorScheme="light"
          tintColor={tintColor}
          style={[styles.inner, contentStyle]}>
          {children}
        </GlassView>
      ) : (
        <View style={[styles.inner, styles.fallback, contentStyle]}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    backgroundColor: colors.glass,
    ...shadows.soft,
  },
  inner: {
    borderRadius: radii.xxl,
    padding: 20,
  },
  fallback: {
    backgroundColor: colors.glassStrong,
  },
});

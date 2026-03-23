import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, shadows } from '../lib/theme';

type GlassButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'secondary';
};

export default function GlassButton({
  label,
  onPress,
  loading = false,
  style,
  variant = 'primary',
}: GlassButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={loading}
      style={[styles.button, variant === 'secondary' ? styles.secondary : styles.primary, style]}>
      <View style={[styles.highlight, variant === 'secondary' ? styles.secondaryHighlight : styles.primaryHighlight]} />
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.ink : colors.white} />
      ) : (
        <Text style={[styles.label, variant === 'secondary' ? styles.secondaryLabel : styles.primaryLabel]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 58,
    borderRadius: radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.ink,
    borderColor: 'rgba(255,255,255,0.18)',
    ...shadows.glow,
  },
  secondary: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderColor: colors.line,
  },
  highlight: {
    position: 'absolute',
    top: 1,
    left: 16,
    right: 16,
    height: 18,
    borderRadius: radii.pill,
  },
  primaryHighlight: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  secondaryHighlight: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  label: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  primaryLabel: {
    color: colors.white,
  },
  secondaryLabel: {
    color: colors.ink,
  },
});

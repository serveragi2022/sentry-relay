import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme';

type StatusKind = 'connected' | 'queued' | 'error' | 'muted';

interface StatusBadgeProps {
  label: string;
  kind: StatusKind;
  showDot?: boolean;
}

export function StatusBadge({ label, kind, showDot = true }: StatusBadgeProps) {
  const palette = colors.status[kind];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      {showDot && <View style={[styles.dot, { backgroundColor: palette.dot }]} />}
      <Text style={[typography.labelSm, styles.text, { color: palette.text }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    includeFontPadding: false,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';

interface SectionLabelProps {
  label: string;
  trailing?: string;
}

export function SectionLabel({ label, trailing }: SectionLabelProps) {
  return (
    <View style={styles.row}>
      <Text style={[typography.labelMd, styles.label]}>{label.toUpperCase()}</Text>
      {trailing ? <Text style={[typography.labelMd, styles.trailing]}>{trailing}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textSecondary,
  },
  trailing: {
    color: colors.secondary,
  },
});

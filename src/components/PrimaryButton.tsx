import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme';

type Variant = 'primary' | 'tonal' | 'outlined' | 'critical';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: PrimaryButtonProps) {
  const variantStyle = VARIANT_STYLES[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variantStyle.container,
        pressed && { opacity: 0.9 },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.textColor} size="small" />
      ) : (
        <Text style={[typography.bodyMd, styles.label, { color: variantStyle.textColor }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const VARIANT_STYLES: Record<Variant, { container: ViewStyle; textColor: string }> = {
  primary: {
    container: { backgroundColor: colors.primary },
    textColor: colors.onPrimary,
  },
  tonal: {
    container: { backgroundColor: colors.surfaceHigh },
    textColor: colors.textPrimary,
  },
  outlined: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    textColor: colors.textPrimary,
  },
  critical: {
    container: { backgroundColor: colors.status.error.bg, borderWidth: 1, borderColor: colors.critical },
    textColor: colors.critical,
  },
};

const styles = StyleSheet.create({
  base: {
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  label: {
    fontWeight: '600',
  },
});

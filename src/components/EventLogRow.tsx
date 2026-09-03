import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme';
import { StatusBadge } from '@/components/StatusBadge';
import { statusToBadgeKind, statusLabel, formatTime } from '@/utils/format';
import type { ForwardedEvent } from '@/types';

const BAR_COLOR: Record<ForwardedEvent['status'], string> = {
  queued: colors.tertiary,
  forwarded: colors.secondary,
  failed: colors.critical,
  discarded: colors.neutral,
};

interface EventLogRowProps {
  event: ForwardedEvent;
  onPress: () => void;
}

export function EventLogRow({ event, onPress }: EventLogRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={[styles.bar, { backgroundColor: BAR_COLOR[event.status] }]} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={[typography.labelMd, styles.appLabel]} numberOfLines={1}>
            {event.appLabel}
          </Text>
          <Text style={[typography.labelSm, styles.time]}>{formatTime(event.receivedAt)}</Text>
        </View>
        <Text style={[typography.bodyMd, styles.title]} numberOfLines={1}>
          {event.title || '(no title)'}
        </Text>
        <Text style={[typography.bodySm, styles.text]} numberOfLines={2}>
          {event.text}
        </Text>
        <View style={styles.footerRow}>
          <StatusBadge label={statusLabel(event.status)} kind={statusToBadgeKind(event.status)} />
          {event.attempts > 0 && (
            <Text style={[typography.labelSm, styles.attempts]}>
              Attempt {event.attempts}/{event.maxAttempts}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  bar: {
    width: 3,
  },
  body: {
    flex: 1,
    padding: spacing.sm + 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  appLabel: {
    color: colors.textSecondary,
    flexShrink: 1,
  },
  time: {
    color: colors.textMuted,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  text: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attempts: {
    color: colors.textMuted,
  },
});

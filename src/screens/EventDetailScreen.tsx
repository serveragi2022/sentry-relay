import React from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '@/theme';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppStore } from '@/store/useAppStore';
import { statusToBadgeKind, statusLabel, formatTimePrecise, formatBytes } from '@/utils/format';

export function EventDetailScreen({ route, navigation }: any) {
  const { eventId } = route.params as { eventId: string };
  const event = useAppStore((s) => s.events.find((e) => e.id === eventId));
  const updateEvent = useAppStore((s) => s.updateEvent);

  if (!event) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={[typography.bodyMd, { padding: spacing.md, color: colors.textSecondary }]}>
          This event is no longer in local history.
        </Text>
      </SafeAreaView>
    );
  }

  function handleDelete() {
    Alert.alert('Delete stored event data', 'This removes the local copy of this event permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          updateEvent(event.id, { status: 'discarded', text: '[deleted]', title: '[deleted]' });
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[typography.headlineSm, styles.eventId]}>Event Inspection</Text>
            <Text style={[typography.labelMd, styles.eventIdSub]}>#{event.id.toUpperCase()}</Text>
          </View>
          <StatusBadge label={statusLabel(event.status)} kind={statusToBadgeKind(event.status)} />
        </View>

        <Text style={[typography.bodySm, styles.subtitle]}>
          Detailed runtime payload telemetry
        </Text>

        <View style={{ height: spacing.lg }} />

        <DetailRow label="Source Application" value={`${event.appLabel} (${event.packageName})`} />
        <DetailRow label="Event Type" value="NotificationListenerService" />
        <DetailRow label="Received Time" value={new Date(event.receivedAt).toLocaleString()} />
        <DetailRow label="Delivery Attempts" value={`${event.attempts} of ${event.maxAttempts}`} />
        <DetailRow
          label="Payload Size"
          value={`${formatBytes(event.rawTextLength)} ${event.sanitized ? '(Sanitized)' : ''}`}
        />
        {event.lastAttemptAt ? (
          <DetailRow label="Last Attempt" value={formatTimePrecise(event.lastAttemptAt)} />
        ) : null}

        <View style={{ height: spacing.md }} />
        <Text style={[typography.labelMd, styles.sectionLabel]}>Message Preview</Text>
        <Card style={styles.mono}>
          <Text style={[typography.labelMd, styles.monoText]}>{event.title || '(no title)'}</Text>
          <Text style={[typography.bodySm, styles.monoBody]}>{event.text}</Text>
        </Card>

        {(event.lastHttpStatus || event.lastResponseBody || event.lastError) && (
          <>
            <View style={{ height: spacing.md }} />
            <Text style={[typography.labelMd, styles.sectionLabel]}>Webhook Response</Text>
            <Card style={styles.mono}>
              {event.lastHttpStatus ? (
                <Text style={[typography.labelMd, styles.monoText]}>
                  HTTP {event.lastHttpStatus}
                </Text>
              ) : null}
              {event.lastError ? (
                <Text style={[typography.bodySm, { color: colors.critical }]}>{event.lastError}</Text>
              ) : null}
              {event.lastResponseBody ? (
                <Text style={[typography.bodySm, styles.monoBody]} numberOfLines={6}>
                  {event.lastResponseBody}
                </Text>
              ) : null}
            </Card>
          </>
        )}

        <View style={{ height: spacing.xl }} />
        <PrimaryButton label="Delete Stored Event Data" variant="critical" onPress={handleDelete} />
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={[typography.labelMd, styles.detailLabel]}>{label.toUpperCase()}</Text>
      <Text style={[typography.bodyMd, styles.detailValue]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  eventId: { color: colors.textPrimary },
  eventIdSub: { color: colors.textMuted, marginTop: 2 },
  subtitle: { color: colors.textSecondary, marginTop: spacing.xs },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: { color: colors.textMuted },
  detailValue: { color: colors.textPrimary, flexShrink: 1, textAlign: 'right', marginLeft: spacing.md },
  sectionLabel: { color: colors.textSecondary, marginBottom: spacing.sm },
  mono: { backgroundColor: colors.surfaceHigh, borderRadius: radii.sm },
  monoText: { color: colors.textPrimary, marginBottom: spacing.xs },
  monoBody: { color: colors.textSecondary },
});

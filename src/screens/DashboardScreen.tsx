import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { PipelineTracker } from '@/components/PipelineTracker';
import { ToggleRow } from '@/components/ToggleRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAppStore } from '@/store/useAppStore';
import { testWebhook } from '@/services/webhookForwarder';
import { openNotificationAccessSettings } from '@/services/permissions';
import { maskWebhookUrl } from '@/utils/format';

export function DashboardScreen({ navigation }: any) {
  const permissionStatus = useAppStore((s) => s.permissionStatus);
  const settings = useAppStore((s) => s.settings);
  const sources = useAppStore((s) => s.sources);
  const events = useAppStore((s) => s.events);
  const toggleSource = useAppStore((s) => s.toggleSource);
  const [testing, setTesting] = useState(false);

  const forwardedToday = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todays = events.filter((e) => e.receivedAt >= startOfDay.getTime());
    const forwarded = todays.filter((e) => e.status === 'forwarded').length;
    const okRate = todays.length ? Math.round((forwarded / todays.length) * 100) : 100;
    return { forwarded, okRate };
  }, [events]);

  const pendingCount = useMemo(
    () => events.filter((e) => e.status === 'queued').length,
    [events]
  );

  const isMonitoringActive =
    settings.forwardingEnabled && permissionStatus === 'authorized' && !!settings.webhookUrl;

  async function handleTestWebhook() {
    if (!settings.webhookUrl) {
      Alert.alert('No webhook configured', 'Set a webhook URL in Settings first.');
      return;
    }
    setTesting(true);
    const result = await testWebhook(settings.webhookUrl, settings.webhookSecret);
    setTesting(false);
    Alert.alert(
      result.success ? 'Test dispatch succeeded' : 'Test dispatch failed',
      result.success
        ? `HTTP ${result.httpStatus}`
        : result.error ?? `HTTP ${result.httpStatus ?? 'unknown'}`
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={[typography.headlineMd, styles.headerTitle]}>Notification Forwarder</Text>
        <View
          style={[
            styles.headerDot,
            { backgroundColor: isMonitoringActive ? colors.secondary : colors.neutral },
          ]}
        />
      </View>
      <Text style={[typography.bodySm, styles.subtitle]}>
        Monitor authorized notifications and forward them to your webhook
      </Text>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.statusCard}>
          <View style={styles.statusHeaderRow}>
            <StatusBadge
              label={isMonitoringActive ? 'Monitoring Active' : 'Monitoring Paused'}
              kind={isMonitoringActive ? 'connected' : 'muted'}
            />
          </View>

          <View style={styles.statGrid}>
            <StatBlock
              label="Notif Access"
              value={permissionStatus === 'authorized' ? 'Enabled' : 'Disabled'}
              good={permissionStatus === 'authorized'}
            />
            <StatBlock
              label="Webhook"
              value={settings.webhookUrl ? 'Connected' : 'Not set'}
              good={!!settings.webhookUrl}
            />
            <StatBlock
              label="Pending Queue"
              value={`${pendingCount} EVTS`}
              subtle="Buffered"
            />
            <StatBlock
              label="Forwarded Today"
              value={String(forwardedToday.forwarded)}
              subtle={`${forwardedToday.okRate}% OK`}
            />
          </View>

          <Text style={[typography.labelMd, styles.pipelineLabel]}>Telemetry Pipeline Stage</Text>
          <PipelineTracker
            completedIndex={pendingCount > 0 ? 1 : isMonitoringActive ? 3 : -1}
            activeIndex={pendingCount > 0 ? 2 : undefined}
          />
        </Card>

        <View style={{ height: spacing.lg }} />

        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.labelMd, styles.sectionHeader]}>Notification Sources</Text>
          <Text style={[typography.labelMd, styles.sectionHeaderTrailing]}>
            {sources.filter((s) => s.enabled).length} Active Listeners
          </Text>
        </View>

        {sources.map((source) => (
          <Card key={source.packageName} style={styles.sourceCard}>
            <View style={styles.sourceRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyLg, styles.sourceLabel]}>{source.label}</Text>
                <Text style={[typography.labelSm, styles.sourcePackage]}>{source.packageName}</Text>
              </View>
            </View>
            <ToggleRow
              title=""
              value={source.enabled}
              onValueChange={() => toggleSource(source.packageName)}
            />
          </Card>
        ))}

        <View style={{ height: spacing.lg }} />

        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.labelMd, styles.sectionHeader]}>Webhook Status</Text>
          <StatusBadge
            label={settings.webhookUrl ? 'Connected' : 'Not Set'}
            kind={settings.webhookUrl ? 'connected' : 'muted'}
          />
        </View>

        <Card>
          <Text style={[typography.bodyMd, styles.webhookHint]}>
            {settings.webhookUrl
              ? 'Events are being forwarded to your configured API.'
              : 'No webhook configured yet. Add one in Settings to start forwarding.'}
          </Text>
          {settings.webhookUrl ? (
            <View style={styles.webhookUrlBox}>
              <Text style={[typography.labelMd, styles.webhookUrlText]} numberOfLines={1}>
                {maskWebhookUrl(settings.webhookUrl)}
              </Text>
            </View>
          ) : null}
          <View style={styles.actionRow}>
            <PrimaryButton
              label="Test Webhook"
              onPress={handleTestWebhook}
              loading={testing}
              style={{ flex: 1 }}
            />
            <View style={{ width: spacing.sm }} />
            <PrimaryButton
              label="Configure"
              variant="outlined"
              onPress={() => navigation.navigate('Settings')}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {permissionStatus !== 'authorized' && (
          <>
            <View style={{ height: spacing.lg }} />
            <Card style={{ borderColor: colors.critical }}>
              <Text style={[typography.bodyMd, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
                Notification access isn't granted yet. Forwarding stays paused until it's enabled.
              </Text>
              <PrimaryButton label="Grant Notification Access" onPress={openNotificationAccessSettings} />
            </Card>
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBlock({
  label,
  value,
  good,
  subtle,
}: {
  label: string;
  value: string;
  good?: boolean;
  subtle?: string;
}) {
  return (
    <View style={styles.statBlock}>
      <Text style={[typography.labelSm, styles.statLabel]}>{label.toUpperCase()}</Text>
      <View style={styles.statValueRow}>
        <Text
          style={[
            typography.headlineSm,
            { color: good === false ? colors.critical : colors.textPrimary },
          ]}
        >
          {value}
        </Text>
        {subtle ? (
          <Text style={[typography.labelSm, styles.statSubtle]}>{subtle}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  headerTitle: { color: colors.textPrimary },
  headerDot: { width: 10, height: 10, borderRadius: 5 },
  subtitle: {
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  scroll: { paddingHorizontal: spacing.md },
  statusCard: {},
  statusHeaderRow: { flexDirection: 'row', marginBottom: spacing.md },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBlock: {
    width: '47%',
    backgroundColor: colors.surfaceHigh,
    borderRadius: 10,
    padding: spacing.sm + 2,
  },
  statLabel: { color: colors.textMuted, marginBottom: spacing.xs },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  statSubtle: { color: colors.secondary },
  pipelineLabel: { color: colors.textMuted, marginBottom: spacing.md },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionHeader: { color: colors.textSecondary },
  sectionHeaderTrailing: { color: colors.secondary },
  sourceCard: { marginBottom: spacing.sm },
  sourceRow: { flexDirection: 'row', marginBottom: -spacing.sm },
  sourceLabel: { color: colors.textPrimary, fontWeight: '600' },
  sourcePackage: { color: colors.textMuted, marginTop: 2 },
  webhookHint: { color: colors.textSecondary, marginBottom: spacing.sm },
  webhookUrlBox: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  webhookUrlText: { color: colors.textSecondary },
  actionRow: { flexDirection: 'row' },
});

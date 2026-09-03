import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '@/theme';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { ToggleRow } from '@/components/ToggleRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { useAppStore } from '@/store/useAppStore';
import { checkNotificationPermission, openNotificationAccessSettings } from '@/services/permissions';
import type { RetentionDays } from '@/types';

const RETENTION_OPTIONS: { value: RetentionDays; label: string }[] = [
  { value: 1, label: 'Keep for 1 Day' },
  { value: 7, label: 'Keep for 7 Days' },
  { value: 30, label: 'Keep for 30 Days' },
  { value: 0, label: 'Keep Forever' },
];

export function SettingsScreen() {
  const permissionStatus = useAppStore((s) => s.permissionStatus);
  const setPermissionStatus = useAppStore((s) => s.setPermissionStatus);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const sources = useAppStore((s) => s.sources);
  const toggleSource = useAppStore((s) => s.toggleSource);
  const clearHistory = useAppStore((s) => s.clearHistory);

  const [webhookDraft, setWebhookDraft] = useState(settings.webhookUrl);
  const [secretDraft, setSecretDraft] = useState(settings.webhookSecret);
  const [retentionOpen, setRetentionOpen] = useState(false);

  async function refreshPermission() {
    const status = await checkNotificationPermission();
    setPermissionStatus(status);
  }

  function handleClearHistory() {
    Alert.alert(
      'Clear all local history?',
      'This purges every cached event log and webhook transaction record on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearHistory },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Text style={[typography.headlineMd, styles.title]}>Permissions & Privacy</Text>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.privacyCard}>
          <View style={styles.privacyHeaderRow}>
            <Text style={[typography.headlineSm, { color: colors.textPrimary }]}>
              Privacy Statement
            </Text>
            <StatusBadge label="Local Only" kind="connected" />
          </View>
          <Text style={[typography.bodyMd, styles.privacyText]}>
            This app only processes notification information after you grant the required Android
            permission. You control which sources are enabled and where event data is sent. Data
            never leaves this device except to the webhook you configure below.
          </Text>
        </Card>

        <View style={{ height: spacing.lg }} />
        <SectionLabel
          label="System Permissions"
          trailing={permissionStatus === 'authorized' ? '1 of 1 Active' : '0 of 1 Active'}
        />

        <Card style={{ borderLeftWidth: 3, borderLeftColor: colors.secondary }}>
          <View style={styles.permHeaderRow}>
            <Text style={[typography.bodyLg, styles.permTitle]}>Notification Access</Text>
            <StatusBadge
              label={permissionStatus === 'authorized' ? 'Enabled' : 'Disabled'}
              kind={permissionStatus === 'authorized' ? 'connected' : 'error'}
            />
          </View>
          <Text style={[typography.bodySm, styles.permDescription]}>
            Allows the app to receive authorized Android notification events via
            NotificationListenerService.
          </Text>
          <PrimaryButton
            label="Manage Access"
            variant="outlined"
            onPress={async () => {
              openNotificationAccessSettings();
              // Give the user a moment in system settings before re-checking.
              setTimeout(refreshPermission, 1500);
            }}
          />
        </Card>

        <View style={{ height: spacing.lg }} />
        <SectionLabel label="Privacy Controls" />

        <Card>
          <ToggleRow
            title="Enable Notification Forwarding"
            description="Master kill switch for dispatching interceptor queues."
            value={settings.forwardingEnabled}
            onValueChange={(v) => updateSettings({ forwardingEnabled: v })}
          />
        </Card>

        <View style={{ height: spacing.sm }} />

        <Card>
          <Text style={[typography.labelMd, styles.sourcesLabel]}>
            ALLOWED NOTIFICATION SOURCES ({sources.filter((s) => s.enabled).length} apps active)
          </Text>
          {sources.map((source) => (
            <ToggleRow
              key={source.packageName}
              title={source.label}
              description={source.packageName}
              value={source.enabled}
              onValueChange={() => toggleSource(source.packageName)}
            />
          ))}
        </Card>

        <View style={{ height: spacing.sm }} />

        <Card>
          <ToggleRow
            title="Store Event History Locally"
            description="Retain an on-device log for delivery verification."
            value={settings.storeHistoryLocally}
            onValueChange={(v) => updateSettings({ storeHistoryLocally: v })}
          />
          <View style={styles.divider} />
          <View style={styles.retentionRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyLg, { color: colors.textPrimary }]}>
                Automatic Deletion Period
              </Text>
              <Text style={[typography.bodySm, styles.permDescription]}>
                Purge logs older than the set window.
              </Text>
            </View>
            <Pressable style={styles.retentionButton} onPress={() => setRetentionOpen((v) => !v)}>
              <Text style={[typography.labelMd, { color: colors.textPrimary }]}>
                {RETENTION_OPTIONS.find((o) => o.value === settings.retentionDays)?.label}
              </Text>
            </Pressable>
          </View>
          {retentionOpen && (
            <View style={styles.retentionOptions}>
              {RETENTION_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={styles.retentionOption}
                  onPress={() => {
                    updateSettings({ retentionDays: opt.value });
                    setRetentionOpen(false);
                  }}
                >
                  <Text style={[typography.bodyMd, { color: colors.textPrimary }]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.divider} />
          <ToggleRow
            title="Show Notification Content in History"
            description="Off — privacy mode active; senders & payload text masked."
            value={settings.showContentInHistory}
            onValueChange={(v) => updateSettings({ showContentInHistory: v })}
          />
        </Card>

        <View style={{ height: spacing.lg }} />
        <SectionLabel label="Webhook Configuration" />
        <Card>
          <Text style={[typography.labelMd, styles.inputLabel]}>WEBHOOK URL</Text>
          <TextInput
            value={webhookDraft}
            onChangeText={setWebhookDraft}
            onBlur={() => updateSettings({ webhookUrl: webhookDraft.trim() })}
            placeholder="https://api.example.com/v1/webhook"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
          <View style={{ height: spacing.sm }} />
          <Text style={[typography.labelMd, styles.inputLabel]}>
            WEBHOOK SECRET (sent as X-Sentry-Relay-Secret header)
          </Text>
          <TextInput
            value={secretDraft}
            onChangeText={setSecretDraft}
            onBlur={() => updateSettings({ webhookSecret: secretDraft })}
            placeholder="Optional shared secret"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            style={styles.input}
          />
        </Card>

        <View style={{ height: spacing.lg }} />
        <PrimaryButton label="Clear All Local History" variant="critical" onPress={handleClearHistory} />
        <Text style={[typography.bodySm, styles.clearHint]}>
          Purges all cached event logs and webhook transaction manifests immediately.
        </Text>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  title: { color: colors.textPrimary, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  scroll: { padding: spacing.md },
  privacyCard: { backgroundColor: colors.surfaceHigh, borderColor: colors.border },
  privacyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  privacyText: { color: colors.textSecondary },
  permHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  permTitle: { color: colors.textPrimary, fontWeight: '600' },
  permDescription: { color: colors.textSecondary, marginBottom: spacing.sm },
  sourcesLabel: { color: colors.textMuted, marginBottom: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  retentionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  retentionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  retentionOptions: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  retentionOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inputLabel: { color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 13,
  },
  clearHint: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});

import React, { useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme';
import { useAdminStore } from '@/store/useAdminStore';
import { PrimaryButton } from './PrimaryButton';

export function AdminLoginModal() {
  const isModalVisible = useAdminStore((s) => s.isModalVisible);
  const error = useAdminStore((s) => s.error);
  const attemptLogin = useAdminStore((s) => s.attemptLogin);
  const cancelLogin = useAdminStore((s) => s.cancelLogin);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  function handleClose() {
    setUsername('');
    setPassword('');
    cancelLogin();
  }

  function handleSubmit() {
    const ok = attemptLogin(username, password);
    if (ok) {
      setUsername('');
      setPassword('');
    }
  }

  return (
    <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={[typography.headlineSm, styles.title]}>Admin Login Required</Text>
          <Text style={[typography.bodySm, styles.subtitle]}>
            Editing settings, toggling notification sources, testing the webhook, and deleting
            stored event data all require admin sign-in.
          </Text>

          <Text style={[typography.labelMd, styles.inputLabel]}>USERNAME</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="admin"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <View style={{ height: spacing.sm }} />

          <Text style={[typography.labelMd, styles.inputLabel]}>PASSWORD</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            onSubmitEditing={handleSubmit}
            style={styles.input}
          />

          {error ? <Text style={[typography.bodySm, styles.errorText]}>{error}</Text> : null}

          <View style={{ height: spacing.md }} />
          <View style={styles.buttonRow}>
            <PrimaryButton label="Cancel" variant="outlined" onPress={handleClose} style={{ flex: 1 }} />
            <View style={{ width: spacing.sm }} />
            <PrimaryButton label="Unlock" onPress={handleSubmit} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surfaceLowest,
    borderRadius: radii.xl,
    padding: spacing.lg,
  },
  title: { color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { color: colors.textSecondary, marginBottom: spacing.md },
  inputLabel: { color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 13,
  },
  errorText: { color: colors.critical, marginTop: spacing.sm },
  buttonRow: { flexDirection: 'row' },
});

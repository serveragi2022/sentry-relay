import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '@/theme';
import { EventLogRow } from '@/components/EventLogRow';
import { useAppStore } from '@/store/useAppStore';
import type { EventStatus } from '@/types';

type FilterKey = 'all' | EventStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'queued', label: 'Queued' },
  { key: 'forwarded', label: 'Forwarded' },
  { key: 'failed', label: 'Failed' },
];

export function EventsScreen({ navigation }: any) {
  const events = useAppStore((s) => s.events);
  const [filter, setFilter] = useState<FilterKey>('all');

  const counts = useMemo(() => {
    const map: Record<FilterKey, number> = { all: events.length, queued: 0, forwarded: 0, failed: 0, discarded: 0 } as any;
    for (const e of events) map[e.status] = (map[e.status] ?? 0) + 1;
    return map;
  }, [events]);

  const filtered = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.status === filter)),
    [events, filter]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Text style={[typography.headlineMd, styles.title]}>Notification Forwarder</Text>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text
                style={[
                  typography.labelMd,
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}
              >
                {f.label} {counts[f.key] ?? 0}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <EventLogRow
            event={item}
            onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[typography.bodyMd, styles.emptyText]}>
              No events yet. Once a source fires a notification, it'll show up here.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  title: { color: colors.textPrimary, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceHigh,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: { color: colors.textSecondary },
  filterChipTextActive: { color: colors.onPrimary },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  empty: { paddingTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
});

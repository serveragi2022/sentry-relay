import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import type { PipelineStage } from '@/types';

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'received', label: 'Authorized' },
  { key: 'monitored', label: 'Monitored' },
  { key: 'queued', label: 'Queued' },
  { key: 'forwarded', label: 'Forwarded' },
];

interface PipelineTrackerProps {
  /** Index of the furthest-completed stage. -1 = nothing completed yet. */
  completedIndex: number;
  /** If set, this stage index renders as "in progress" (amber, pulsing implied via border). */
  activeIndex?: number;
}

export function PipelineTracker({ completedIndex, activeIndex }: PipelineTrackerProps) {
  return (
    <View style={styles.row}>
      {STAGES.map((stage, index) => {
        const isDone = index <= completedIndex;
        const isActive = index === activeIndex && !isDone;
        return (
          <React.Fragment key={stage.key}>
            <View style={styles.node}>
              <View
                style={[
                  styles.circle,
                  isDone && styles.circleDone,
                  isActive && styles.circleActive,
                ]}
              >
                {isDone && <View style={styles.check} />}
              </View>
              <Text style={[typography.labelSm, styles.label]}>{stage.label}</Text>
            </View>
            {index < STAGES.length - 1 && (
              <View
                style={[
                  styles.connector,
                  index < completedIndex && styles.connectorDone,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const NODE_SIZE = 24;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  node: {
    alignItems: 'center',
    width: 64,
  },
  circle: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  circleActive: {
    borderColor: colors.tertiary,
    backgroundColor: colors.status.queued.bg,
  },
  check: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.onSecondary,
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginTop: NODE_SIZE / 2 - 1,
    marginHorizontal: -8,
  },
  connectorDone: {
    backgroundColor: colors.secondary,
  },
  label: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

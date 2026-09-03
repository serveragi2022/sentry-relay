/**
 * Design tokens transcribed from sentry_relay/DESIGN.md
 * "Engineering-grade, privacy-first utility" — Material 3 mechanics,
 * technical utility minimalism, zero decorative bloat.
 */

export const colors = {
  primary: '#0F172A', // Deep Privacy Slate
  onPrimary: '#FFFFFF',
  secondary: '#10B981', // Active Emerald — healthy states only
  onSecondary: '#FFFFFF',
  tertiary: '#F59E0B', // Amber — latency / queued / degraded
  onTertiary: '#1E1300',
  neutral: '#64748B', // Slate Gray — metadata, borders, inactive
  critical: '#EF4444', // Rose — revocations, failures, dead-letter
  onCritical: '#FFFFFF',

  background: '#F8FAFC',
  onBackground: '#0F172A',
  surfaceLowest: '#FFFFFF',
  surfaceHigh: '#F1F5F9', // telemetry blocks, input recesses
  border: '#E2E8F0',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // Status badge pairs: { bg, text, dot }
  status: {
    connected: { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
    queued: { bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B' },
    error: { bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
    muted: { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' },
  },
} as const;

export const typography = {
  headlineLg: { fontFamily: 'Inter_700Bold', fontSize: 26, lineHeight: 32, letterSpacing: -0.2 },
  headlineMd: { fontFamily: 'Inter_600SemiBold', fontSize: 20, lineHeight: 26, letterSpacing: -0.1 },
  headlineSm: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 22 },
  bodyLg: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },
  bodyMd: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },
  labelLg: { fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 13, lineHeight: 18, letterSpacing: 0.3 },
  labelMd: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, lineHeight: 16, letterSpacing: 0.5 },
  labelSm: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10, lineHeight: 14, letterSpacing: 0.6 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 6, // payload / code insets
  md: 8, // buttons, inputs
  lg: 12, // cards
  xl: 16, // large cards
  full: 9999, // pill badges, switches
} as const;

export const shadows = {
  level1: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  level2: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;

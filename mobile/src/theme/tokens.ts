/** Mirrors `src/styles.scss` :root design tokens */
export const tokens = {
  bgDeep: '#060607',
  bg: '#0c0c0e',
  bgElevated: '#121215',
  surface: '#16161c',
  surface2: '#1e1e26',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  text: '#f4f4f5',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  accent: '#2dd4bf',
  accentHover: '#5eead4',
  accentGlow: 'rgba(45, 212, 191, 0.22)',
  accentSubtle: 'rgba(45, 212, 191, 0.12)',
  pr: '#bef264',
  prBg: 'rgba(190, 242, 100, 0.1)',
  last: '#94a3b8',
  danger: '#f87171',
  dangerBg: 'rgba(248, 113, 113, 0.12)',
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  shadowCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

/** Loaded via `useFonts` in App — use these strings in fontFamily */
export const fonts = {
  display: 'Outfit_600SemiBold',
  displayBold: 'Outfit_700Bold',
  displayReg: 'Outfit_400Regular',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
} as const;

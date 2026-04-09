import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { listCardioPersonalRecords, listSetPersonalRecords } from '../domain/weeklyComputed';
import { useAllWeekLogs } from '../services/weeklyData';
import { GradientBackground } from '../ui/GradientBackground';
import { fonts, tokens } from '../theme/tokens';

export function PrSummaryScreen() {
  const { user } = useAuth();
  const logs = useAllWeekLogs(user?.uid ?? null);

  const strengthRows = useMemo(
    () => listSetPersonalRecords(logs).filter((r) => r.bestKg > 0),
    [logs],
  );

  const cardioRows = useMemo(() => listCardioPersonalRecords(logs).filter((r) => r.bestMinutes > 0), [logs]);

  return (
    <GradientBackground>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Personal records</Text>

      <Text style={styles.sectionTitle}>Strength</Text>
      <Text style={styles.hint}>Highest weight (kg) you logged on each set for each exercise, across all weeks.</Text>

      {strengthRows.length === 0 ? (
        <Text style={styles.empty}>No strength PRs yet. Log weights on Today to build history.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.rowHead}>
            <Text style={[styles.cell, styles.cellHead, styles.colEx]}>Exercise</Text>
            <Text style={[styles.cell, styles.cellHead, styles.colSet]}>Set</Text>
            <Text style={[styles.cell, styles.cellHead, styles.colKg]}>Best (kg)</Text>
          </View>
          {strengthRows.map((r) => (
            <View style={styles.row} key={`${r.exerciseKey}-${r.setIndex}`}>
              <Text style={[styles.cell, styles.colEx]}>{r.exerciseName}</Text>
              <Text style={[styles.cell, styles.colSet]}>{r.setIndex}</Text>
              <Text style={[styles.cell, styles.colKg]}>{r.bestKg}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.sectionTitle, styles.mt]}>Cardio</Text>
      <Text style={styles.hint}>Longest duration (minutes) you logged for each cardio exercise, across all weeks.</Text>

      {cardioRows.length === 0 ? (
        <Text style={styles.empty}>No cardio PRs yet. Log duration on Today for cardio exercises.</Text>
      ) : (
        <View style={styles.table}>
          <View style={styles.rowHead}>
            <Text style={[styles.cell, styles.cellHead, styles.colExWide]}>Exercise</Text>
            <Text style={[styles.cell, styles.cellHead, styles.colMin]}>Longest (min)</Text>
          </View>
          {cardioRows.map((r) => (
            <View style={styles.row} key={r.exerciseKey}>
              <Text style={[styles.cell, styles.colExWide]}>{r.exerciseName}</Text>
              <Text style={[styles.cell, styles.colMin]}>{r.bestMinutes}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    letterSpacing: -0.5,
    fontWeight: '700',
    color: tokens.text,
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: tokens.text,
    marginTop: 24,
    marginBottom: 4,
  },
  mt: { marginTop: 24 },
  hint: {
    fontFamily: fonts.body,
    color: tokens.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
    marginBottom: 16,
  },
  empty: {
    fontFamily: fonts.body,
    color: tokens.textMuted,
    fontStyle: 'italic',
    marginBottom: 12,
    textAlign: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tokens.border,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.surface,
  },
  table: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusMd,
    overflow: 'hidden',
    backgroundColor: tokens.surface,
  },
  rowHead: { flexDirection: 'row', backgroundColor: tokens.bgElevated },
  row: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: tokens.border },
  cell: {
    fontFamily: fonts.body,
    padding: 12,
    color: tokens.textSecondary,
    fontSize: 14,
  },
  cellHead: {
    fontFamily: fonts.display,
    fontWeight: '600',
    color: tokens.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  colEx: { flex: 2 },
  colExWide: { flex: 3 },
  colSet: { width: 48 },
  colKg: { width: 88, textAlign: 'right', fontFamily: fonts.bodyBold, color: tokens.pr, fontWeight: '700' },
  colMin: { flex: 1, textAlign: 'right', fontFamily: fonts.bodyBold, color: tokens.pr, fontWeight: '700' },
});

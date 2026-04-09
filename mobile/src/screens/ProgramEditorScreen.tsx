import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { randomUUID } from 'expo-crypto';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../context/AuthContext';
import {
  EMPTY_WEEKLY_PROGRAM,
  type ExerciseKind,
  type ProgramExercise,
  type WeeklyProgram,
  resolvedExerciseKind,
  resolvedSetCount,
} from '../domain/weekly.models';
import { DAYS, dayLabel, dayOfWeekFromDate, type DayOfWeek } from '../domain/weekly-utils';
import { useWeeklyProgram, saveProgramRemote } from '../services/weeklyData';
import { GradientBackground } from '../ui/GradientBackground';
import { fonts, tokens } from '../theme/tokens';

const kinds: { id: ExerciseKind; label: string }[] = [
  { id: 'strength', label: 'Strength (weights)' },
  { id: 'cardio', label: 'Cardio (duration)' },
];

export function ProgramEditorScreen() {
  const { user } = useAuth();
  const remote = useWeeklyProgram(user?.uid ?? null);

  const [draft, setDraft] = useState<WeeklyProgram>(() => JSON.parse(JSON.stringify(EMPTY_WEEKLY_PROGRAM)));
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(dayOfWeekFromDate(new Date()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    setDraft(JSON.parse(JSON.stringify(remote)));
  }, [user?.uid, remote]);

  function exerciseCountLabel(day: DayOfWeek): string {
    const n = draft[day].length;
    return n === 1 ? '1 exercise' : `${n} exercises`;
  }

  function prevEditorDay(): void {
    const i = DAYS.indexOf(selectedDay);
    setSelectedDay(DAYS[(i - 1 + DAYS.length) % DAYS.length]!);
  }

  function nextEditorDay(): void {
    const i = DAYS.indexOf(selectedDay);
    setSelectedDay(DAYS[(i + 1) % DAYS.length]!);
  }

  function addExercise(day: DayOfWeek): void {
    const exerciseKey = randomUUID();
    const row: ProgramExercise = {
      exerciseKey,
      name: '',
      notes: '',
      kind: 'strength',
      setCount: 3,
    };
    setDraft((d) => ({ ...d, [day]: [...d[day], row] }));
  }

  function removeExercise(day: DayOfWeek, exerciseKey: string): void {
    setDraft((d) => ({ ...d, [day]: d[day].filter((e) => e.exerciseKey !== exerciseKey) }));
  }

  function updateName(day: DayOfWeek, exerciseKey: string, name: string): void {
    setDraft((d) => ({
      ...d,
      [day]: d[day].map((e) => (e.exerciseKey === exerciseKey ? { ...e, name } : e)),
    }));
  }

  function updateNotes(day: DayOfWeek, exerciseKey: string, notes: string): void {
    setDraft((d) => ({
      ...d,
      [day]: d[day].map((e) => (e.exerciseKey === exerciseKey ? { ...e, notes } : e)),
    }));
  }

  function updateKind(day: DayOfWeek, exerciseKey: string, kind: ExerciseKind): void {
    setDraft((d) => ({
      ...d,
      [day]: d[day].map((e) => {
        if (e.exerciseKey !== exerciseKey) return e;
        if (kind === 'cardio') {
          const { setCount: _, ...rest } = e;
          return { ...rest, kind: 'cardio' };
        }
        return { ...e, kind: 'strength', setCount: e.setCount ?? 3 };
      }),
    }));
  }

  function updateSetCount(day: DayOfWeek, exerciseKey: string, count: number): void {
    const n = Math.min(12, Math.max(1, Math.round(Number(count)) || 3));
    setDraft((d) => ({
      ...d,
      [day]: d[day].map((e) => (e.exerciseKey === exerciseKey ? { ...e, setCount: n } : e)),
    }));
  }

  async function save(): Promise<void> {
    setMessage(null);
    setBusy(true);
    try {
      await saveProgramRemote(draft);
      setMessage('Saved. Your week template will repeat every week.');
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  const day = selectedDay;

  return (
    <GradientBackground>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Edit week template</Text>
      <Text style={styles.hint}>
        Pick a day to edit that day&apos;s plan. Add strength lifts with a chosen number of sets, or cardio for
        duration on the Today tab.
      </Text>

      {message ? (
        <Text style={[styles.msg, message.startsWith('Saved') ? styles.msgOk : styles.msgErr]}>{message}</Text>
      ) : null}

      <View style={styles.dayBar}>
        <Pressable style={styles.dayNav} onPress={prevEditorDay}>
          <Text style={styles.dayNavText}>←</Text>
        </Pressable>
        <Text style={styles.dayPickerLabel}>
          {dayLabel(day)} · {exerciseCountLabel(day)}
        </Text>
        <Pressable style={styles.dayNav} onPress={nextEditorDay}>
          <Text style={styles.dayNavText}>→</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.dayTitle}>{dayLabel(day)}</Text>
        {draft[day].length === 0 ? (
          <Text style={styles.empty}>Rest day — or add exercises below.</Text>
        ) : (
          draft[day].map((ex) => (
            <View key={ex.exerciseKey} style={styles.exCard}>
              <View style={styles.exRow}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={ex.name}
                  onChangeText={(t) => updateName(day, ex.exerciseKey, t)}
                  placeholder="e.g. Back squat or Treadmill"
                  placeholderTextColor={tokens.textMuted}
                />
                <Pressable onPress={() => removeExercise(day, ex.exerciseKey)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
              <View style={styles.optsRow}>
                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.kindRow}>
                  {kinds.map((k) => (
                    <Pressable
                      key={k.id}
                      style={[
                        styles.kindChip,
                        (ex.kind === 'cardio' ? 'cardio' : 'strength') === k.id && styles.kindChipOn,
                      ]}
                      onPress={() => updateKind(day, ex.exerciseKey, k.id)}
                    >
                      <Text
                        style={[
                          styles.kindChipText,
                          (ex.kind === 'cardio' ? 'cardio' : 'strength') === k.id && styles.kindChipTextOn,
                        ]}
                      >
                        {k.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              {resolvedExerciseKind(ex) === 'strength' ? (
                <View style={styles.optsRow}>
                  <Text style={styles.fieldLabel}>Sets</Text>
                  <TextInput
                    style={styles.inputNarrow}
                    keyboardType="number-pad"
                    value={String(ex.setCount ?? 3)}
                    onChangeText={(t) => updateSetCount(day, ex.exerciseKey, Number(t))}
                  />
                </View>
              ) : null}
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                multiline
                value={ex.notes ?? ''}
                onChangeText={(t) => updateNotes(day, ex.exerciseKey, t)}
                placeholder="Optional: tempo, pace, heart rate…"
                placeholderTextColor={tokens.textMuted}
              />
            </View>
          ))
        )}
        <Pressable style={styles.addBtn} onPress={() => addExercise(day)}>
          <Text style={styles.addBtnText}>+ Add exercise</Text>
        </Pressable>
      </View>

      <Pressable style={[styles.saveOuter, busy && styles.saveDisabled]} onPress={save} disabled={busy}>
        <LinearGradient
          colors={[tokens.accent, '#0d9488']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.save}
        >
          <Text style={styles.saveText}>{busy ? 'Saving…' : 'Save template'}</Text>
        </LinearGradient>
      </Pressable>
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
  heading: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    letterSpacing: -0.5,
    fontWeight: '700',
    color: tokens.text,
  },
  hint: {
    fontFamily: fonts.body,
    marginTop: 8,
    color: tokens.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  msg: { marginTop: 12, fontSize: 14, fontFamily: fonts.body },
  msgOk: { color: tokens.pr },
  msgErr: { color: tokens.danger },
  dayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
  },
  dayNav: {
    width: 40,
    height: 40,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    backgroundColor: tokens.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNavText: { color: tokens.text, fontSize: 18 },
  dayPickerLabel: { fontFamily: fonts.display, color: tokens.text, fontWeight: '600', fontSize: 15 },
  section: {
    marginTop: 12,
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusMd,
    padding: 16,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  dayTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  empty: { color: tokens.textMuted, marginBottom: 12 },
  exCard: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border,
  },
  exRow: { gap: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: tokens.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 10,
    color: tokens.text,
    backgroundColor: tokens.surface2,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  inputNarrow: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    padding: 10,
    color: tokens.text,
    width: 80,
    backgroundColor: tokens.surface2,
    fontFamily: fonts.body,
  },
  textarea: { minHeight: 64, textAlignVertical: 'top' },
  remove: { color: tokens.danger, marginTop: 8, fontSize: 14 },
  optsRow: { marginTop: 8 },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  kindChipOn: { backgroundColor: '#27272a', borderColor: tokens.accent },
  kindChipText: { color: tokens.textMuted, fontSize: 13 },
  kindChipTextOn: { color: tokens.text, fontWeight: '600' },
  addBtn: { alignSelf: 'flex-start', marginTop: 8 },
  addBtnText: { color: tokens.accent, fontSize: 16, fontWeight: '600' },
  saveOuter: { marginTop: 24, borderRadius: 999, overflow: 'hidden', alignSelf: 'flex-start' },
  save: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  saveDisabled: { opacity: 0.45 },
  saveText: {
    fontFamily: fonts.displayBold,
    fontWeight: '700',
    color: '#042f2e',
    fontSize: 15,
  },
});

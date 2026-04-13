import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';

import type { MainTabParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import {
  type ProgramExercise,
  type WeekLogExercise,
  type WeeklyProgram,
  resolvedExerciseKind,
  resolvedSetCount,
} from '../domain/weekly.models';
import {
  DAYS,
  addDays,
  dateForWeekday,
  dayLabel,
  dayOfWeekFromDate,
  formatLocalDate,
  mondayOfWeekContaining,
  shortDayLabel,
  sundayOfWeek,
  type DayOfWeek,
} from '../domain/weekly-utils';
import { computeBestCardioMinutes, computeBestPerExerciseSet } from '../domain/weeklyComputed';
import {
  useAllWeekLogs,
  useWeeklyProgram,
  useWeekLogsForMonday,
  saveWeekDayLogRemote,
} from '../services/weeklyData';
import { GradientBackground } from '../ui/GradientBackground';
import { fonts, tokens } from '../theme/tokens';

const WORKOUT_GATE_STORAGE_PREFIX = 'fitness_workout_gate_v1';
const AUTOSAVE_MS = 800;
/** iOS: updating draft every keystroke re-renders and fights UITextField; batch writes to draft. */
const DRAFT_INPUT_DEBOUNCE_MS = 120;

type PendingNumericField =
  | { kind: 'strength'; day: DayOfWeek; ex: ProgramExercise; si: number }
  | { kind: 'cardio'; day: DayOfWeek; ex: ProgramExercise };

type DraftEntry =
  | { kind: 'strength'; weights: number[]; completed: boolean }
  | { kind: 'cardio'; minutes: number; completed: boolean };

type DraftMap = Record<string, DraftEntry>;

function gateKey(uid: string, weekKey: string, day: DayOfWeek): string {
  return `${WORKOUT_GATE_STORAGE_PREFIX}:${uid}:${weekKey}:${day}`;
}

function makeDraftKey(day: DayOfWeek, exerciseKey: string): string {
  return `${day}_${exerciseKey}`;
}

/** Raw TextInput text while editing — decoupled from draft so Firestore sync can't eat digits. */
function overlayFieldKeyStrength(draftKey: string, setIdx: number): string {
  return `${draftKey}::s${setIdx}`;
}
function overlayFieldKeyCardio(draftKey: string): string {
  return `${draftKey}::c`;
}
function draftKeyHasActiveWeightOverlay(
  overlay: Record<string, string>,
  draftKey: string,
): boolean {
  const cardio = overlayFieldKeyCardio(draftKey);
  if (overlay[cardio] !== undefined) return true;
  return Object.keys(overlay).some((k) => k.startsWith(`${draftKey}::s`));
}

function defaultDraftEntry(ex: ProgramExercise): DraftEntry {
  if (resolvedExerciseKind(ex) === 'cardio') {
    return { kind: 'cardio', minutes: 0, completed: false };
  }
  const n = resolvedSetCount(ex);
  return { kind: 'strength', weights: Array(n).fill(0), completed: false };
}

function buildWeekLogExercises(
  day: DayOfWeek,
  program: WeeklyProgram,
  draftMap: DraftMap,
): WeekLogExercise[] {
  const prog = program[day];
  return prog.map((ex) => {
    const key = makeDraftKey(day, ex.exerciseKey);
    const d = draftMap[key] ?? defaultDraftEntry(ex);
    const completed = d.completed === true;
    if (resolvedExerciseKind(ex) === 'cardio') {
      const minutes = d.kind === 'cardio' ? d.minutes : 0;
      return {
        exerciseKey: ex.exerciseKey,
        name: ex.name,
        kind: 'cardio' as const,
        durationMinutes: Number.isFinite(minutes) ? minutes : 0,
        ...(completed ? { completed: true } : {}),
      };
    }
    const n = resolvedSetCount(ex);
    const weights = d.kind === 'strength' ? [...d.weights] : Array(n).fill(0);
    while (weights.length < n) weights.push(0);
    return {
      exerciseKey: ex.exerciseKey,
      name: ex.name,
      kind: 'strength' as const,
      sets: weights.slice(0, n),
      ...(completed ? { completed: true } : {}),
    };
  });
}

export function WeekViewScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [weekMonday, setWeekMonday] = useState(() => mondayOfWeekContaining(new Date()));
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => dayOfWeekFromDate(new Date()));
  const [draft, setDraft] = useState<DraftMap>({});
  const [savingDay, setSavingDay] = useState<DayOfWeek | null>(null);
  const [gateEpoch, setGateEpoch] = useState(0);
  const [gateOpen, setGateOpen] = useState(false);

  const autosaveTimers = useRef<Map<DayOfWeek, ReturnType<typeof setTimeout>>>(new Map());
  /**
   * Raw strings while editing. Do not clear on blur — RN often fires blur between keystrokes
   * (ScrollView/keyboard), which was dropping digits. Cleared on day/week change only.
   */
  const [weightTextOverlay, setWeightTextOverlay] = useState<Record<string, string>>({});
  const weightTextOverlayRef = useRef(weightTextOverlay);
  weightTextOverlayRef.current = weightTextOverlay;

  const latestPendingDraftTextRef = useRef<Record<string, string>>({});
  const draftDebounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingFieldMetaRef = useRef<Map<string, PendingNumericField>>(new Map());
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const flushAllPendingDraftInputsRef = useRef<() => void>(() => {});

  const program = useWeeklyProgram(uid);
  const logs = useWeekLogsForMonday(uid, weekMonday);
  const prevWeekMonday = useMemo(() => addDays(weekMonday, -7), [weekMonday]);
  const prevLogs = useWeekLogsForMonday(uid, prevWeekMonday);
  const allLogs = useAllWeekLogs(uid);

  const setBests = useMemo(() => computeBestPerExerciseSet(allLogs), [allLogs]);
  const cardioBests = useMemo(() => computeBestCardioMinutes(allLogs), [allLogs]);

  const weekKey = formatLocalDate(weekMonday);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    AsyncStorage.getItem(gateKey(uid, weekKey, selectedDay)).then((v) => {
      if (!cancelled) setGateOpen(v === '1');
    });
    return () => {
      cancelled = true;
    };
  }, [uid, weekKey, selectedDay, gateEpoch]);

  useEffect(() => {
    setDraft((prev) => {
      const next: DraftMap = {};
      for (const d of DAYS) {
        const log = logs[d];
        for (const ex of program[d]) {
          const key = makeDraftKey(d, ex.exerciseKey);
          if (draftKeyHasActiveWeightOverlay(weightTextOverlayRef.current, key) && prev[key]) {
            next[key] = prev[key];
            continue;
          }
          const found = log?.exercises.find((e) => e.exerciseKey === ex.exerciseKey);
          const completed = found?.completed === true;
          if (resolvedExerciseKind(ex) === 'cardio') {
            let minutes = 0;
            if (found?.kind === 'cardio' && found.durationMinutes != null && Number.isFinite(found.durationMinutes)) {
              minutes = found.durationMinutes;
            }
            next[key] = { kind: 'cardio', minutes, completed };
          } else {
            const n = resolvedSetCount(ex);
            const weights = Array(n).fill(0) as number[];
            if (found?.kind === 'strength' && found.sets?.length) {
              for (let i = 0; i < n; i++) weights[i] = found.sets[i] ?? 0;
            }
            next[key] = { kind: 'strength', weights, completed };
          }
        }
      }
      return next;
    });
  }, [program, logs]);

  useEffect(() => {
    flushAllPendingDraftInputsRef.current();
    setWeightTextOverlay({});
  }, [selectedDay]);

  useEffect(() => {
    for (const t of autosaveTimers.current.values()) clearTimeout(t);
    autosaveTimers.current.clear();
    flushAllPendingDraftInputsRef.current();
    setWeightTextOverlay({});
  }, [weekMonday]);

  useEffect(() => {
    return () => {
      for (const t of autosaveTimers.current.values()) clearTimeout(t);
      autosaveTimers.current.clear();
      for (const t of draftDebounceTimersRef.current.values()) clearTimeout(t);
      draftDebounceTimersRef.current.clear();
    };
  }, []);

  const clearAutosaveTimer = useCallback((day: DayOfWeek) => {
    const t = autosaveTimers.current.get(day);
    if (t) {
      clearTimeout(t);
      autosaveTimers.current.delete(day);
    }
  }, []);

  const queueAutosaveRef = useRef<(d: DayOfWeek) => void>(() => {});

  const setIndexes = useCallback((ex: ProgramExercise) => {
    const n = resolvedSetCount(ex);
    return Array.from({ length: n }, (_, i) => i);
  }, []);

  const getStrengthWeight = (day: DayOfWeek, ex: ProgramExercise, setIdx: number): number => {
    const e = draft[makeDraftKey(day, ex.exerciseKey)];
    if (e?.kind !== 'strength') return 0;
    return e.weights[setIdx] ?? 0;
  };

  const setStrengthWeight = (day: DayOfWeek, ex: ProgramExercise, setIdx: number, value: string) => {
    const key = makeDraftKey(day, ex.exerciseKey);
    const n = resolvedSetCount(ex);
    const num = parseFloat(value);
    const v = Number.isFinite(num) ? num : 0;
    setDraft((m) => {
      const cur = m[key];
      let weights: number[] = cur?.kind === 'strength' ? [...cur.weights] : Array(n).fill(0);
      while (weights.length < n) weights.push(0);
      weights[setIdx] = v;
      const done = cur?.kind === 'strength' ? cur.completed : false;
      return { ...m, [key]: { kind: 'strength', weights, completed: done } };
    });
    queueAutosaveRef.current(day);
  };

  const getCardioMinutes = (day: DayOfWeek, ex: ProgramExercise): number => {
    const e = draft[makeDraftKey(day, ex.exerciseKey)];
    if (e?.kind !== 'cardio') return 0;
    return e.minutes;
  };

  const setCardioMinutes = (day: DayOfWeek, ex: ProgramExercise, value: string) => {
    const key = makeDraftKey(day, ex.exerciseKey);
    const num = parseFloat(value);
    const minutes = Number.isFinite(num) ? num : 0;
    const cur = draft[key];
    const done = cur?.kind === 'cardio' ? cur.completed : false;
    setDraft((m) => ({ ...m, [key]: { kind: 'cardio', minutes, completed: done } }));
    queueAutosaveRef.current(day);
  };

  const setStrengthWeightRef = useRef(setStrengthWeight);
  const setCardioMinutesRef = useRef(setCardioMinutes);
  setStrengthWeightRef.current = setStrengthWeight;
  setCardioMinutesRef.current = setCardioMinutes;

  const flushAllPendingDraftInputs = useCallback(() => {
    for (const [fk, timer] of [...draftDebounceTimersRef.current.entries()]) {
      clearTimeout(timer);
      draftDebounceTimersRef.current.delete(fk);
      const text = latestPendingDraftTextRef.current[fk];
      const m = pendingFieldMetaRef.current.get(fk);
      if (!m || text === undefined) continue;
      if (m.kind === 'strength') {
        setStrengthWeightRef.current(m.day, m.ex, m.si, text);
      } else {
        setCardioMinutesRef.current(m.day, m.ex, text);
      }
    }
  }, []);

  flushAllPendingDraftInputsRef.current = flushAllPendingDraftInputs;

  const scheduleDebouncedDraftInput = useCallback(
    (fieldKey: string, meta: PendingNumericField, text: string) => {
      latestPendingDraftTextRef.current[fieldKey] = text;
      pendingFieldMetaRef.current.set(fieldKey, meta);
      const prev = draftDebounceTimersRef.current.get(fieldKey);
      if (prev) clearTimeout(prev);
      const tid = setTimeout(() => {
        draftDebounceTimersRef.current.delete(fieldKey);
        const t = latestPendingDraftTextRef.current[fieldKey];
        const m = pendingFieldMetaRef.current.get(fieldKey);
        if (!m || t === undefined) return;
        if (m.kind === 'strength') {
          setStrengthWeightRef.current(m.day, m.ex, m.si, t);
        } else {
          setCardioMinutesRef.current(m.day, m.ex, t);
        }
      }, DRAFT_INPUT_DEBOUNCE_MS);
      draftDebounceTimersRef.current.set(fieldKey, tid);
    },
    [],
  );

  const persistDay = useCallback(
    async (day: DayOfWeek, draftMap?: DraftMap) => {
      flushAllPendingDraftInputs();
      await new Promise<void>((r) => setTimeout(r, 0));
      clearAutosaveTimer(day);
      const map = draftMap ?? draftRef.current;
      const exercises = buildWeekLogExercises(day, program, map);
      await saveWeekDayLogRemote(weekMonday, day, exercises);
    },
    [clearAutosaveTimer, flushAllPendingDraftInputs, program, weekMonday],
  );

  const queueAutosave = useCallback(
    (d: DayOfWeek) => {
      if (program[d].length === 0) return;
      const wk = formatLocalDate(weekMonday);
      clearAutosaveTimer(d);
      const t = setTimeout(() => {
        autosaveTimers.current.delete(d);
        if (formatLocalDate(weekMonday) !== wk) return;
        void persistDay(d).catch((e) => console.error('Auto-save failed', e));
      }, AUTOSAVE_MS);
      autosaveTimers.current.set(d, t);
    },
    [clearAutosaveTimer, persistDay, program, weekMonday],
  );

  queueAutosaveRef.current = queueAutosave;

  const lastWeekSetKg = (day: DayOfWeek, exerciseKey: string, setIdx: number): number | null => {
    const prev = prevLogs[day];
    const ex = prev?.exercises.find((e) => e.exerciseKey === exerciseKey);
    if (!ex || ex.kind === 'cardio' || !ex.sets?.length) return null;
    const v = ex.sets[setIdx];
    return v != null ? v : null;
  };

  const lastWeekCardioMinutes = (day: DayOfWeek, exerciseKey: string): number | null => {
    const prev = prevLogs[day];
    const ex = prev?.exercises.find((e) => e.exerciseKey === exerciseKey);
    if (!ex || ex.kind !== 'cardio' || ex.durationMinutes == null || !Number.isFinite(ex.durationMinutes)) {
      return null;
    }
    return ex.durationMinutes;
  };

  const bestEverSetKg = (exerciseKey: string, setIdx: number): number | null => {
    const row = setBests.get(exerciseKey);
    if (!row) return null;
    const v = row[setIdx];
    return v != null && v > 0 ? v : null;
  };

  const bestCardioMinutesEver = (exerciseKey: string): number | null => {
    const v = cardioBests.get(exerciseKey);
    return v != null && v > 0 ? v : null;
  };

  const isExerciseComplete = (day: DayOfWeek, ex: ProgramExercise): boolean => {
    const d = draft[makeDraftKey(day, ex.exerciseKey)];
    return d?.completed === true;
  };

  const exercisesSortedForDay = (day: DayOfWeek): ProgramExercise[] => {
    const prog = program[day];
    const incomplete = prog.filter((ex) => !isExerciseComplete(day, ex));
    const complete = prog.filter((ex) => isExerciseComplete(day, ex));
    return [...incomplete, ...complete];
  };

  const firstCompletedSortIndex = (sorted: ProgramExercise[], day: DayOfWeek): number => {
    return sorted.findIndex((ex) => isExerciseComplete(day, ex));
  };

  const isNextUp = (day: DayOfWeek, ex: ProgramExercise): boolean => {
    const sorted = exercisesSortedForDay(day);
    const next = sorted.find((e) => !isExerciseComplete(day, e));
    return next !== undefined && next.exerciseKey === ex.exerciseKey;
  };

  const toggleExerciseComplete = async (day: DayOfWeek, ex: ProgramExercise) => {
    flushAllPendingDraftInputs();
    await new Promise<void>((r) => setTimeout(r, 0));
    const key = makeDraftKey(day, ex.exerciseKey);
    const stored = draftRef.current[key];
    const base = stored ?? defaultDraftEntry(ex);
    const nextCompleted = !base.completed;
    const nextEntry: DraftEntry =
      base.kind === 'strength'
        ? { ...base, completed: nextCompleted }
        : { ...base, completed: nextCompleted };
    const nextDraft: DraftMap = { ...draftRef.current, [key]: nextEntry };
    setDraft(nextDraft);
    try {
      // Pass nextDraft so we don't persist stale React state (setDraft is async).
      await persistDay(day, nextDraft);
    } catch {
      if (stored) {
        setDraft((m) => ({ ...m, [key]: stored }));
      } else {
        setDraft((m) => {
          const out = { ...m };
          delete out[key];
          return out;
        });
      }
    }
  };

  const saveDay = async (day: DayOfWeek) => {
    if (program[day].length === 0) return;
    clearAutosaveTimer(day);
    setSavingDay(day);
    try {
      await persistDay(day);
    } finally {
      setSavingDay(null);
    }
  };

  const startWorkout = async (day: DayOfWeek) => {
    if (uid) await AsyncStorage.setItem(gateKey(uid, weekKey, day), '1');
    setGateEpoch((n) => n + 1);
  };

  const day = selectedDay;
  const sortedEx = exercisesSortedForDay(day);
  const splitIdx = firstCompletedSortIndex(sortedEx, day);

  const chipDateLabel = (d: DayOfWeek) =>
    dateForWeekday(weekMonday, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const isChipToday = (d: DayOfWeek) =>
    formatLocalDate(dateForWeekday(weekMonday, d)) === formatLocalDate(new Date());

  const weekRangeLabel = () => {
    const mon = weekMonday;
    const sun = sundayOfWeek(mon);
    return `${formatLocalDate(mon)} → ${formatLocalDate(sun)}`;
  };

  const plannedExerciseLabel = (d: DayOfWeek) => {
    const n = program[d].length;
    return n === 1 ? '1 exercise lined up' : `${n} exercises lined up`;
  };

  const hasStartedWorkout = gateOpen;

  return (
    <GradientBackground>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      removeClippedSubviews={false}
    >
      <View style={styles.links}>
        <Pressable style={styles.btnSecondary} onPress={() => navigation.navigate('Template')}>
          <Text style={styles.btnSecondaryText}>Edit week template</Text>
        </Pressable>
        <Pressable style={styles.btnSecondary} onPress={() => navigation.navigate('PRs')}>
          <Text style={styles.btnSecondaryText}>PRs</Text>
        </Pressable>
      </View>

      <View style={styles.daySlider}>
        <Pressable style={styles.weekArrow} onPress={() => setWeekMonday((m) => addDays(m, -7))}>
          <Text style={styles.weekArrowText}>←</Text>
        </Pressable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dayStrip}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {DAYS.map((d) => (
            <Pressable
              key={d}
              style={[styles.dayChip, selectedDay === d && styles.dayChipActive, isChipToday(d) && styles.dayChipToday]}
              onPress={() => setSelectedDay(d)}
            >
              <Text style={[styles.dow, selectedDay === d && styles.dowActive]}>{shortDayLabel(d)}</Text>
              <Text style={styles.dom}>{chipDateLabel(d)}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable style={styles.weekArrow} onPress={() => setWeekMonday((m) => addDays(m, 7))}>
          <Text style={styles.weekArrowText}>→</Text>
        </Pressable>
      </View>

      <Text style={styles.weekCaption}>
        <Text style={styles.capLabel}>Week </Text>
        <Text style={styles.capRange}>{weekRangeLabel()}</Text>
        {'  '}
        <Text style={styles.link} onPress={() => {
          const today = new Date();
          setWeekMonday(mondayOfWeekContaining(today));
          setSelectedDay(dayOfWeekFromDate(today));
        }}>
          Today
        </Text>
      </Text>

      {hasStartedWorkout ? (
        <View style={styles.intro}>
          <Text style={styles.introText}>
            Swipe the <Text style={styles.introStrong}>day strip</Text> to pick a weekday (defaults to{' '}
            <Text style={styles.introStrong}>today</Text>). Use ← → to change the calendar week.{' '}
            <Text style={styles.introStrong}>Weights and cardio</Text> save automatically shortly after you stop typing; tap{' '}
            <Text style={styles.introStrong}>Save now</Text> to write to the cloud immediately. Tap{' '}
            <Text style={styles.introStrong}>Complete</Text> when you finish an exercise — it moves to the bottom and the
            next one stays on top with a <Text style={styles.introStrong}>Next</Text> label. For strength we show{' '}
            <Text style={styles.introStrong}>last week</Text> and <Text style={styles.introStrong}>best ever</Text> per
            set; for cardio, duration (minutes) with last week and longest logged.
          </Text>
        </View>
      ) : (
        <View style={styles.introGate}>
          <Text style={styles.introText}>
            Pick the day you&apos;re training above, then tap <Text style={styles.introStrong}>Start workout</Text> when
            you&apos;re ready. Your plan stays hidden until then — a small ritual to get in the zone.
          </Text>
        </View>
      )}

      <View style={styles.dayCard}>
        <LinearGradient
          colors={[tokens.accent, 'rgba(45, 212, 191, 0.35)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.dayCardAccent}
        />
        <View style={styles.dayHeader}>
          <View>
            <Text style={styles.dayTitle}>{dayLabel(day)}</Text>
            <Text style={styles.subdate}>{chipDateLabel(day)}</Text>
          </View>
          {program[day].length > 0 && hasStartedWorkout ? (
            <Pressable
              onPress={() => void saveDay(day)}
              disabled={savingDay === day}
              style={styles.primaryBtnOuter}
            >
              <LinearGradient
                colors={[tokens.accent, '#0d9488']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.primaryBtn, savingDay === day && styles.primaryBtnDisabled]}
              >
                {savingDay === day ? (
                  <ActivityIndicator color="#042f2e" />
                ) : (
                  <Text style={styles.primaryBtnText}>Save now</Text>
                )}
              </LinearGradient>
            </Pressable>
          ) : null}
        </View>

        {program[day].length === 0 ? (
          <Text style={styles.emptyDay}>
            No exercises for {dayLabel(day)}. Add them in Edit week template.
          </Text>
        ) : !hasStartedWorkout ? (
          <View style={styles.gate}>
            <Text style={styles.gateEyebrow}>You showed up</Text>
            <Text style={styles.gateTitle}>Ready to train {dayLabel(day)}?</Text>
            <Text style={styles.gateLead}>
              Lock in for this session. Once you start, your full plan opens up.
            </Text>
            <Text style={styles.gateCount}>{plannedExerciseLabel(day)} for this day.</Text>
            <Pressable style={styles.gateStart} onPress={() => void startWorkout(day)}>
              <LinearGradient
                colors={[tokens.accent, '#0d9488']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gateStartGrad}
              >
                <Text style={styles.gateStartText}>Start workout</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          sortedEx.map((ex, i) => {
            const exDraftKey = makeDraftKey(day, ex.exerciseKey);
            const cardioOverlayKey = overlayFieldKeyCardio(exDraftKey);
            return (
              <View key={ex.exerciseKey}>
                {splitIdx > 0 && i === splitIdx ? (
                  <View style={styles.completedRow}>
                    <View style={styles.completedLineShort} />
                    <Text style={styles.completedLabel}>Completed</Text>
                    <View style={styles.completedLineFlex} />
                  </View>
                ) : null}
                <View style={[styles.exBlock, isExerciseComplete(day, ex) && styles.exDone]}>
                  <View style={styles.exHead}>
                    <View style={styles.titleStack}>
                      <Text style={styles.exName}>{ex.name}</Text>
                      <View style={styles.titleMeta}>
                        {isNextUp(day, ex) ? (
                          <Text style={styles.nextPill}>Next</Text>
                        ) : null}
                        {resolvedExerciseKind(ex) === 'cardio' ? (
                          <Text style={styles.kindPill}>Cardio</Text>
                        ) : null}
                      </View>
                    </View>
                    <Pressable
                      style={[styles.completeBtn, isExerciseComplete(day, ex) && styles.completeBtnOn]}
                      onPress={() => void toggleExerciseComplete(day, ex)}
                    >
                      <Text
                        style={[
                          styles.completeBtnText,
                          isExerciseComplete(day, ex) && styles.completeBtnTextDone,
                        ]}
                      >
                        {isExerciseComplete(day, ex) ? 'Completed' : 'Complete'}
                      </Text>
                    </Pressable>
                  </View>
                  {ex.notes?.trim() ? <Text style={styles.exNotes}>{ex.notes.trim()}</Text> : null}

                  {resolvedExerciseKind(ex) === 'cardio' ? (
                    <View style={styles.cardioBlock}>
                      <Text style={styles.setLabel}>Duration</Text>
                      <View style={styles.cardioRow}>
                        <TextInput
                          style={styles.numInput}
                          keyboardType="decimal-pad"
                          blurOnSubmit={false}
                          autoCorrect={false}
                          autoCapitalize="none"
                          {...(Platform.OS === 'ios' ? { textContentType: 'none' as const } : {})}
                          value={
                            weightTextOverlay[cardioOverlayKey] ?? String(getCardioMinutes(day, ex))
                          }
                          onFocus={() => {
                            setWeightTextOverlay((prev) => ({
                              ...prev,
                              [cardioOverlayKey]: String(getCardioMinutes(day, ex)),
                            }));
                          }}
                          onChangeText={(t) => {
                            setWeightTextOverlay((prev) => ({ ...prev, [cardioOverlayKey]: t }));
                            scheduleDebouncedDraftInput(cardioOverlayKey, { kind: 'cardio', day, ex }, t);
                          }}
                        />
                        <Text style={styles.unit}>min</Text>
                      </View>
                      <View style={styles.hints}>
                        {lastWeekCardioMinutes(day, ex.exerciseKey) != null ? (
                          <Text style={styles.hintLast}>
                            Last week: <Text style={styles.hintStrong}>{lastWeekCardioMinutes(day, ex.exerciseKey)}</Text>{' '}
                            min
                          </Text>
                        ) : (
                          <Text style={styles.hintMuted}>No log last week</Text>
                        )}
                        {bestCardioMinutesEver(ex.exerciseKey) != null ? (
                          <Text style={styles.hintPr}>
                            Longest logged: <Text style={styles.hintStrong}>{bestCardioMinutesEver(ex.exerciseKey)}</Text>{' '}
                            min
                          </Text>
                        ) : (
                          <Text style={styles.hintMuted}>No history yet</Text>
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={styles.setsGrid}>
                      {setIndexes(ex).map((si) => {
                        const setOverlayKey = overlayFieldKeyStrength(exDraftKey, si);
                        return (
                          <View style={styles.setCol} key={si}>
                            <Text style={styles.setLabel}>Set {si + 1}</Text>
                            <View style={styles.setRow}>
                              <TextInput
                                style={styles.numInput}
                                keyboardType="decimal-pad"
                                blurOnSubmit={false}
                                autoCorrect={false}
                                autoCapitalize="none"
                                {...(Platform.OS === 'ios' ? { textContentType: 'none' as const } : {})}
                                value={
                                  weightTextOverlay[setOverlayKey] ??
                                  String(getStrengthWeight(day, ex, si))
                                }
                                onFocus={() => {
                                  setWeightTextOverlay((prev) => ({
                                    ...prev,
                                    [setOverlayKey]: String(getStrengthWeight(day, ex, si)),
                                  }));
                                }}
                                onChangeText={(t) => {
                                  setWeightTextOverlay((prev) => ({ ...prev, [setOverlayKey]: t }));
                                  scheduleDebouncedDraftInput(
                                    setOverlayKey,
                                    { kind: 'strength', day, ex, si },
                                    t,
                                  );
                                }}
                              />
                              <Text style={styles.unit}>kg</Text>
                            </View>
                            <View style={styles.hints}>
                              {lastWeekSetKg(day, ex.exerciseKey, si) != null ? (
                                <Text style={styles.hintLast}>
                                  Last week:{' '}
                                  <Text style={styles.hintStrong}>{lastWeekSetKg(day, ex.exerciseKey, si)}</Text> kg
                                </Text>
                              ) : (
                                <Text style={styles.hintMuted}>No log last week</Text>
                              )}
                              {bestEverSetKg(ex.exerciseKey, si) != null ? (
                                <Text style={styles.hintPr}>
                                  Best ever: <Text style={styles.hintStrong}>{bestEverSetKg(ex.exerciseKey, si)}</Text> kg
                                </Text>
                              ) : (
                                <Text style={styles.hintMuted}>No history yet</Text>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40, paddingHorizontal: 20, maxWidth: 720, alignSelf: 'center', width: '100%' },
  links: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  btnSecondary: {
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: tokens.surface,
  },
  btnSecondaryText: {
    fontFamily: fonts.bodySemi,
    color: tokens.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  daySlider: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  weekArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekArrowText: { color: tokens.text, fontSize: 18 },
  dayStrip: { flex: 1, maxHeight: 76, paddingVertical: 6 },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginHorizontal: 3,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.surface,
    alignItems: 'center',
    minWidth: 54,
  },
  dayChipActive: {
    borderColor: 'rgba(45, 212, 191, 0.45)',
    backgroundColor: tokens.surface2,
    shadowColor: tokens.accent,
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  dayChipToday: { borderColor: 'rgba(45, 212, 191, 0.25)' },
  dow: {
    fontFamily: fonts.displayBold,
    fontSize: 11,
    color: tokens.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dowActive: { color: tokens.text },
  dom: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: tokens.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  weekCaption: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 18 },
  capLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    fontFamily: fonts.bodyBold,
    color: tokens.textMuted,
    fontWeight: '700',
  },
  capRange: { fontFamily: fonts.display, color: tokens.textSecondary, fontWeight: '600' },
  link: { color: tokens.accent, fontFamily: fonts.bodySemi, fontWeight: '600', fontSize: 13 },
  intro: {
    marginBottom: 20,
    padding: 16,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.accentSubtle,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.15)',
  },
  introGate: {
    marginBottom: 20,
    padding: 16,
    borderRadius: tokens.radiusMd,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.22)',
    backgroundColor: tokens.accentSubtle,
  },
  introText: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: tokens.textSecondary,
  },
  introStrong: { fontFamily: fonts.bodySemi, color: tokens.text, fontWeight: '600' },
  dayCard: {
    position: 'relative',
    marginHorizontal: 0,
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingVertical: 18,
    paddingHorizontal: 19,
    paddingLeft: 22,
    ...tokens.shadowCard,
  },
  dayCardAccent: {
    position: 'absolute',
    left: 0,
    top: 16,
    bottom: 16,
    width: 3,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
    paddingLeft: 2,
  },
  dayTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 19,
    letterSpacing: -0.3,
    color: tokens.text,
    fontWeight: '700',
  },
  subdate: { fontFamily: fonts.bodyMedium, color: tokens.textMuted, marginTop: 4, fontSize: 14 },
  primaryBtnOuter: { borderRadius: 999, overflow: 'hidden' },
  primaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: {
    fontFamily: fonts.displayBold,
    color: '#042f2e',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyDay: {
    fontFamily: fonts.body,
    color: tokens.textMuted,
    paddingLeft: 4,
    fontSize: 14,
    lineHeight: 22,
  },
  gate: {
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderRadius: tokens.radiusLg,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.25)',
    backgroundColor: tokens.bgElevated,
  },
  gateEyebrow: {
    fontFamily: fonts.bodyBold,
    color: tokens.accent,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    fontWeight: '800',
  },
  gateTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: tokens.text,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  gateLead: {
    fontFamily: fonts.body,
    color: tokens.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
    fontSize: 14,
    maxWidth: 340,
  },
  gateCount: {
    fontFamily: fonts.bodySemi,
    color: tokens.textMuted,
    marginTop: 14,
    fontSize: 13,
    fontWeight: '600',
  },
  gateStart: { marginTop: 20, borderRadius: 999, overflow: 'hidden', ...tokens.shadowCard },
  gateStartGrad: { paddingHorizontal: 28, paddingVertical: 12, alignItems: 'center' },
  gateStartText: {
    fontFamily: fonts.displayBold,
    color: '#042f2e',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 12,
    paddingLeft: 4,
  },
  completedLineShort: { width: 32, height: 1, backgroundColor: tokens.borderStrong },
  completedLineFlex: { flex: 1, height: 1, backgroundColor: tokens.borderStrong },
  completedLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.9,
    color: tokens.textMuted,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  exBlock: {
    marginBottom: 4,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
    paddingLeft: 4,
  },
  exDone: { opacity: 0.55 },
  exHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleStack: { flex: 1, marginRight: 8 },
  exName: {
    fontFamily: fonts.display,
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text,
    letterSpacing: -0.2,
  },
  titleMeta: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  nextPill: {
    fontFamily: fonts.displayBold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    overflow: 'hidden',
    color: tokens.accent,
    backgroundColor: 'rgba(45, 212, 191, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.45)',
  },
  kindPill: {
    fontFamily: fonts.bodyBold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    overflow: 'hidden',
    color: '#7dd3fc',
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
  },
  completeBtn: {
    borderWidth: 1,
    borderColor: tokens.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: tokens.surface2,
  },
  completeBtnOn: {
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
    borderColor: 'rgba(45, 212, 191, 0.4)',
  },
  completeBtnText: {
    fontFamily: fonts.displayBold,
    color: tokens.textSecondary,
    fontWeight: '700',
    fontSize: 11,
  },
  completeBtnTextDone: { color: tokens.accent },
  exNotes: {
    fontFamily: fonts.body,
    color: tokens.textSecondary,
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    padding: 10,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.bgElevated,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  cardioBlock: { marginTop: 10, maxWidth: 220 },
  cardioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  setsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  setCol: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 140,
    padding: 12,
    borderRadius: tokens.radiusMd,
    backgroundColor: tokens.bgElevated,
    borderWidth: 1,
    borderColor: tokens.border,
    gap: 6,
  },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: tokens.textMuted,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  numInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: tokens.text,
    backgroundColor: tokens.surface2,
    minWidth: 64,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    fontWeight: '600',
  },
  unit: {
    fontFamily: fonts.bodySemi,
    color: tokens.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hints: { marginTop: 6, gap: 4 },
  hintLast: { fontFamily: fonts.body, fontSize: 12, color: tokens.last },
  hintPr: { fontFamily: fonts.body, fontSize: 12, color: tokens.pr, paddingVertical: 2 },
  hintStrong: { fontFamily: fonts.bodyBold, color: tokens.textSecondary, fontWeight: '700' },
  hintMuted: { fontFamily: fonts.body, fontSize: 12, color: tokens.textMuted, fontStyle: 'italic' },
});

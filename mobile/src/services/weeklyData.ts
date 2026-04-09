import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  EMPTY_WEEKLY_PROGRAM,
  type ExerciseKind,
  type ProgramExercise,
  type WeeklyProgram,
  type WeekDayLogWithId,
  type WeekLogExercise,
  resolvedExerciseKind,
  resolvedSetCount,
} from '../domain/weekly.models';
import { DAYS, type DayOfWeek, formatLocalDate, weekLogDocId } from '../domain/weekly-utils';

const SETTINGS_COLLECTION = 'settings';
const WEEKLY_PROGRAM_DOC = 'weeklyProgram';
const WEEK_LOGS_COLLECTION = 'weekLogs';

interface ProgramExerciseRaw {
  exerciseKey?: string;
  name?: string;
  notes?: string;
  description?: string;
  kind?: string;
  setCount?: number;
  setsCount?: number;
}

function emptyLogsRecord(): Record<DayOfWeek, WeekDayLogWithId | null> {
  return {
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
    saturday: null,
    sunday: null,
  };
}

function mapProgramFromFirestore(raw: Record<string, unknown> | undefined): WeeklyProgram {
  const base: WeeklyProgram = JSON.parse(JSON.stringify(EMPTY_WEEKLY_PROGRAM));
  if (!raw) return base;
  for (const day of DAYS) {
    const arr = raw[day];
    if (Array.isArray(arr)) {
      base[day] = arr
        .filter((x) => x && typeof (x as ProgramExerciseRaw).name === 'string')
        .map((x, idx) => {
          const o = x as ProgramExerciseRaw;
          const notesRaw = o.notes ?? o.description;
          const notesTrimmed =
            typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : undefined;
          const kind: ExerciseKind = o.kind === 'cardio' ? 'cardio' : 'strength';
          const setCountRaw = o.setCount ?? o.setsCount;
          let setCount: number | undefined;
          if (kind === 'strength' && setCountRaw != null) {
            const n = Math.round(Number(setCountRaw));
            if (Number.isFinite(n)) setCount = Math.min(12, Math.max(1, n));
          }
          const keyFromDoc =
            typeof o.exerciseKey === 'string' && o.exerciseKey.trim().length > 0
              ? o.exerciseKey.trim()
              : '';
          return {
            // Stable fallback so snapshots don't rotate keys and wipe draft/logs alignment.
            exerciseKey: keyFromDoc || `${day}-ex-${idx}`,
            name: String(o.name).trim(),
            kind,
            ...(kind === 'strength' && setCount != null ? { setCount } : {}),
            ...(notesTrimmed ? { notes: notesTrimmed } : {}),
          };
        })
        .filter((x) => x.name.length > 0);
    }
  }
  return base;
}

function mapWeekLogExercise(e: Record<string, unknown>): WeekLogExercise {
  const kind: ExerciseKind = e['kind'] === 'cardio' ? 'cardio' : 'strength';
  const name = String(e['name'] ?? '');
  const exerciseKey = String(e['exerciseKey'] ?? '');
  const completed = e['completed'] === true;
  if (kind === 'cardio') {
    const dm = e['durationMinutes'];
    let durationMinutes: number | null = null;
    if (typeof dm === 'number' && Number.isFinite(dm)) durationMinutes = dm;
    else if (typeof dm === 'string' && dm.trim()) {
      const p = parseFloat(dm);
      if (Number.isFinite(p)) durationMinutes = p;
    }
    return { exerciseKey, name, kind: 'cardio', durationMinutes, ...(completed ? { completed: true } : {}) };
  }
  const setsRaw = e['sets'];
  let sets: number[] = [0, 0, 0];
  if (Array.isArray(setsRaw)) {
    sets = setsRaw.map((x) => Number(x)).map((n) => (Number.isFinite(n) ? n : 0));
    if (sets.length === 0) sets = [0, 0, 0];
  }
  return { exerciseKey, name, kind: 'strength', sets, ...(completed ? { completed: true } : {}) };
}

function mapWeekLogFromFirestore(w: WeekDayLogWithId): WeekDayLogWithId {
  const exercises = (w.exercises ?? []).map((e) => mapWeekLogExercise(e as unknown as Record<string, unknown>));
  return {
    id: w.id,
    weekMondayKey: w.weekMondayKey,
    dayOfWeek: w.dayOfWeek as DayOfWeek,
    exercises,
  };
}

function sanitizeProgram(program: WeeklyProgram): WeeklyProgram {
  const out: WeeklyProgram = JSON.parse(JSON.stringify(EMPTY_WEEKLY_PROGRAM));
  for (const day of DAYS) {
    out[day] = program[day]
      .map((e) => {
        const name = e.name.trim();
        const notes = e.notes?.trim();
        const kind = resolvedExerciseKind(e);
        const base: ProgramExercise = {
          exerciseKey: e.exerciseKey,
          name,
          kind,
          ...(notes ? { notes } : {}),
        };
        if (kind === 'strength') {
          return { ...base, setCount: resolvedSetCount(e) };
        }
        return base;
      })
      .filter((e) => e.name.length > 0);
  }
  return out;
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('You must be signed in.');
  return uid;
}

export function useWeeklyProgram(uid: string | null): WeeklyProgram {
  const [program, setProgram] = useState<WeeklyProgram>(EMPTY_WEEKLY_PROGRAM);
  useEffect(() => {
    if (!uid) {
      setProgram(EMPTY_WEEKLY_PROGRAM);
      return;
    }
    const d = doc(db, 'users', uid, SETTINGS_COLLECTION, WEEKLY_PROGRAM_DOC);
    return onSnapshot(d, (snap) => {
      setProgram(mapProgramFromFirestore(snap.data() as Record<string, unknown> | undefined));
    });
  }, [uid]);
  return program;
}

export function useAllWeekLogs(uid: string | null): WeekDayLogWithId[] {
  const [logs, setLogs] = useState<WeekDayLogWithId[]>([]);
  useEffect(() => {
    if (!uid) {
      setLogs([]);
      return;
    }
    const ref = collection(db, 'users', uid, WEEK_LOGS_COLLECTION);
    return onSnapshot(ref, (snap) => {
      const list = snap.docs.map((docSnap) =>
        mapWeekLogFromFirestore({
          id: docSnap.id,
          ...(docSnap.data() as Omit<WeekDayLogWithId, 'id'>),
        } as WeekDayLogWithId),
      );
      setLogs(list);
    });
  }, [uid]);
  return logs;
}

export function useWeekLogsForMonday(
  uid: string | null,
  weekMonday: Date,
): Record<DayOfWeek, WeekDayLogWithId | null> {
  const key = formatLocalDate(weekMonday);
  const [byDay, setByDay] = useState<Record<DayOfWeek, WeekDayLogWithId | null>>(emptyLogsRecord());

  useEffect(() => {
    if (!uid) {
      setByDay(emptyLogsRecord());
      return;
    }
    const ref = collection(db, 'users', uid, WEEK_LOGS_COLLECTION);
    const q = query(ref, where('weekMondayKey', '==', key));
    return onSnapshot(q, (snap) => {
      const mapped = snap.docs.map((docSnap) =>
        mapWeekLogFromFirestore({
          id: docSnap.id,
          ...(docSnap.data() as Omit<WeekDayLogWithId, 'id'>),
        } as WeekDayLogWithId),
      );
      const next: Record<DayOfWeek, WeekDayLogWithId | null> = emptyLogsRecord();
      for (const row of mapped) {
        next[row.dayOfWeek] = row;
      }
      setByDay(next);
    });
  }, [uid, key]);

  return byDay;
}

export async function saveProgramRemote(program: WeeklyProgram): Promise<void> {
  const u = requireUid();
  const sanitized = sanitizeProgram(program);
  const d = doc(db, 'users', u, SETTINGS_COLLECTION, WEEKLY_PROGRAM_DOC);
  await setDoc(
    d,
    {
      monday: sanitized.monday,
      tuesday: sanitized.tuesday,
      wednesday: sanitized.wednesday,
      thursday: sanitized.thursday,
      friday: sanitized.friday,
      saturday: sanitized.saturday,
      sunday: sanitized.sunday,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveWeekDayLogRemote(
  weekMonday: Date,
  day: DayOfWeek,
  exercises: WeekLogExercise[],
): Promise<void> {
  const u = requireUid();
  const id = weekLogDocId(weekMonday, day);
  const d = doc(db, 'users', u, WEEK_LOGS_COLLECTION, id);
  const payload = exercises.map((e) => {
    const completed = e.completed === true;
    if (e.kind === 'cardio') {
      const dm = e.durationMinutes;
      return {
        exerciseKey: e.exerciseKey,
        name: e.name.trim(),
        kind: 'cardio' as const,
        durationMinutes: dm == null || !Number.isFinite(Number(dm)) ? null : Number(dm),
        ...(completed ? { completed: true } : {}),
      };
    }
    return {
      exerciseKey: e.exerciseKey,
      name: e.name.trim(),
      kind: 'strength' as const,
      sets: (e.sets ?? []).map((x) => Number(x)),
      ...(completed ? { completed: true } : {}),
    };
  });
  await setDoc(
    d,
    {
      weekMondayKey: formatLocalDate(weekMonday),
      dayOfWeek: day,
      exercises: payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

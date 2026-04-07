import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Observable, of, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ExerciseKind, WeeklyProgram, WeekDayLogWithId, WeekLogExercise } from '../models/weekly.models';
import {
  EMPTY_WEEKLY_PROGRAM,
  resolvedExerciseKind,
  resolvedSetCount,
} from '../models/weekly.models';
import type { DayOfWeek } from '../weekly/weekly-utils';
import { DAYS, addDays, formatLocalDate, weekLogDocId } from '../weekly/weekly-utils';

const SETTINGS_COLLECTION = 'settings';
const WEEKLY_PROGRAM_DOC = 'weeklyProgram';
const WEEK_LOGS_COLLECTION = 'weekLogs';

@Injectable({ providedIn: 'root' })
export class WeeklyService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  private readonly userId$ = new Observable<string | null>((sub) => {
    const unsub = onAuthStateChanged(this.auth, (u) => sub.next(u?.uid ?? null));
    return () => unsub();
  });

  program$(): Observable<WeeklyProgram> {
    return this.userId$.pipe(
      switchMap((uid) => {
        if (!uid) return of(EMPTY_WEEKLY_PROGRAM);
        const d = doc(this.firestore, 'users', uid, SETTINGS_COLLECTION, WEEKLY_PROGRAM_DOC);
        return docData(d).pipe(
          map((raw) => this.mapProgramFromFirestore(raw as Record<string, unknown> | undefined)),
        );
      }),
    );
  }

  allWeekLogs$(): Observable<WeekDayLogWithId[]> {
    return this.userId$.pipe(
      switchMap((uid) => {
        if (!uid) return of([]);
        const ref = collection(this.firestore, 'users', uid, WEEK_LOGS_COLLECTION);
        return collectionData(ref, { idField: 'id' }) as Observable<WeekDayLogWithId[]>;
      }),
      map((list) => list.map((w: WeekDayLogWithId) => this.mapWeekLogFromFirestore(w))),
    );
  }

  weekLogsForMonday$(weekMonday: Date): Observable<Record<DayOfWeek, WeekDayLogWithId | null>> {
    const key = formatLocalDate(weekMonday);
    return this.userId$.pipe(
      switchMap((uid) => {
        if (!uid) return of([] as WeekDayLogWithId[]);
        const ref = collection(this.firestore, 'users', uid, WEEK_LOGS_COLLECTION);
        const q = query(ref, where('weekMondayKey', '==', key));
        return collectionData(q, { idField: 'id' }) as Observable<WeekDayLogWithId[]>;
      }),
      map((list) => {
        const mapped = list.map((w: WeekDayLogWithId) => this.mapWeekLogFromFirestore(w));
        const byDay: Record<DayOfWeek, WeekDayLogWithId | null> = {
          monday: null,
          tuesday: null,
          wednesday: null,
          thursday: null,
          friday: null,
          saturday: null,
          sunday: null,
        };
        for (const row of mapped) {
          byDay[row.dayOfWeek] = row;
        }
        return byDay;
      }),
    );
  }

  async saveProgram(program: WeeklyProgram): Promise<void> {
    const uid = this.requireUid();
    const sanitized = this.sanitizeProgram(program);
    const d = doc(this.firestore, 'users', uid, SETTINGS_COLLECTION, WEEKLY_PROGRAM_DOC);
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

  async saveWeekDayLog(weekMonday: Date, day: DayOfWeek, exercises: WeekLogExercise[]): Promise<void> {
    const uid = this.requireUid();
    const id = weekLogDocId(weekMonday, day);
    const d = doc(this.firestore, 'users', uid, WEEK_LOGS_COLLECTION, id);
    const payload = exercises.map((e) => {
      const completed = e.completed === true;
      if (e.kind === 'cardio') {
        const dm = e.durationMinutes;
        return {
          exerciseKey: e.exerciseKey,
          name: e.name.trim(),
          kind: 'cardio' as const,
          durationMinutes:
            dm == null || !Number.isFinite(Number(dm)) ? null : Number(dm),
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

  /** Strength only: per-set best kg; array length grows with max sets seen. */
  computeBestPerExerciseSet(logs: WeekDayLogWithId[]): Map<string, number[]> {
    const m = new Map<string, number[]>();
    for (const log of logs) {
      for (const ex of log.exercises) {
        if (ex.kind === 'cardio' || !ex.sets?.length) continue;
        const cur = m.get(ex.exerciseKey) ?? [];
        const next = [...cur];
        for (let i = 0; i < ex.sets.length; i++) {
          const v = ex.sets[i];
          next[i] = Math.max(next[i] ?? 0, v);
        }
        m.set(ex.exerciseKey, next);
      }
    }
    return m;
  }

  /** Cardio: longest session in minutes per exercise key. */
  computeBestCardioMinutes(logs: WeekDayLogWithId[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const log of logs) {
      for (const ex of log.exercises) {
        if (ex.kind !== 'cardio' || ex.durationMinutes == null || !Number.isFinite(ex.durationMinutes)) {
          continue;
        }
        const prev = m.get(ex.exerciseKey) ?? 0;
        if (ex.durationMinutes > prev) m.set(ex.exerciseKey, ex.durationMinutes);
      }
    }
    return m;
  }

  listSetPersonalRecords(logs: WeekDayLogWithId[]): {
    exerciseKey: string;
    exerciseName: string;
    setIndex: number;
    bestKg: number;
    whenLabel: string;
  }[] {
    const m = new Map<string, { name: string; bests: number[] }>();
    for (const log of logs) {
      for (const ex of log.exercises) {
        if (ex.kind === 'cardio' || !ex.sets?.length) continue;
        const prev = m.get(ex.exerciseKey);
        if (!prev) {
          m.set(ex.exerciseKey, { name: ex.name, bests: [...ex.sets] });
        } else {
          const maxLen = Math.max(prev.bests.length, ex.sets.length);
          const merged: number[] = [];
          for (let i = 0; i < maxLen; i++) {
            merged[i] = Math.max(prev.bests[i] ?? 0, ex.sets[i] ?? 0);
          }
          prev.bests = merged;
        }
      }
    }
    const rows: {
      exerciseKey: string;
      exerciseName: string;
      setIndex: number;
      bestKg: number;
      whenLabel: string;
    }[] = [];
    for (const [exerciseKey, { name, bests }] of m) {
      for (let i = 0; i < bests.length; i++) {
        rows.push({
          exerciseKey,
          exerciseName: name,
          setIndex: i + 1,
          bestKg: bests[i],
          whenLabel: 'all weeks',
        });
      }
    }
    return rows.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.setIndex - b.setIndex);
  }

  listCardioPersonalRecords(logs: WeekDayLogWithId[]): {
    exerciseKey: string;
    exerciseName: string;
    bestMinutes: number;
  }[] {
    const m = new Map<string, { name: string; best: number }>();
    for (const log of logs) {
      for (const ex of log.exercises) {
        if (ex.kind !== 'cardio' || ex.durationMinutes == null || !Number.isFinite(ex.durationMinutes)) {
          continue;
        }
        const prev = m.get(ex.exerciseKey);
        if (!prev || ex.durationMinutes > prev.best) {
          m.set(ex.exerciseKey, { name: ex.name, best: ex.durationMinutes });
        }
      }
    }
    return [...m.entries()]
      .map(([exerciseKey, { name, best }]) => ({
        exerciseKey,
        exerciseName: name,
        bestMinutes: best,
      }))
      .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
  }

  previousWeekMonday(weekMonday: Date): Date {
    return addDays(weekMonday, -7);
  }

  private mapProgramFromFirestore(raw: Record<string, unknown> | undefined): WeeklyProgram {
    const base: WeeklyProgram = structuredClone(EMPTY_WEEKLY_PROGRAM);
    if (!raw) return base;
    for (const day of DAYS) {
      const arr = raw[day];
      if (Array.isArray(arr)) {
        base[day] = arr
          .filter((x) => x && typeof (x as ProgramExerciseRaw).name === 'string')
          .map((x) => {
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
            return {
              exerciseKey: typeof o.exerciseKey === 'string' ? o.exerciseKey : crypto.randomUUID(),
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

  private mapWeekLogFromFirestore(w: WeekDayLogWithId): WeekDayLogWithId {
    const exercises = (w.exercises ?? []).map((e) => this.mapWeekLogExercise(e as unknown as Record<string, unknown>));
    return {
      id: w.id,
      weekMondayKey: w.weekMondayKey,
      dayOfWeek: w.dayOfWeek as DayOfWeek,
      exercises,
    };
  }

  private mapWeekLogExercise(e: Record<string, unknown>): WeekLogExercise {
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

  private sanitizeProgram(program: WeeklyProgram): WeeklyProgram {
    const out: WeeklyProgram = structuredClone(EMPTY_WEEKLY_PROGRAM);
    for (const day of DAYS) {
      out[day] = program[day]
        .map((e) => {
          const name = e.name.trim();
          const notes = e.notes?.trim();
          const kind = resolvedExerciseKind(e);
          const base: (typeof program)[typeof day][0] = {
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

  private requireUid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('You must be signed in.');
    return uid;
  }
}

interface ProgramExerciseRaw {
  exerciseKey?: string;
  name?: string;
  notes?: string;
  description?: string;
  kind?: string;
  setCount?: number;
  setsCount?: number;
}

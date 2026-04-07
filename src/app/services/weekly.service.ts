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
import type { WeeklyProgram, WeekDayLogWithId, WeekLogExercise } from '../models/weekly.models';
import { EMPTY_WEEKLY_PROGRAM } from '../models/weekly.models';
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

  /** Repeating Mon–Sun exercise list (empty days allowed). */
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

  /** All week/day logs (for PRs and analytics). */
  allWeekLogs$(): Observable<WeekDayLogWithId[]> {
    return this.userId$.pipe(
      switchMap((uid) => {
        if (!uid) return of([]);
        const ref = collection(this.firestore, 'users', uid, WEEK_LOGS_COLLECTION);
        return collectionData(ref, { idField: 'id' }) as Observable<WeekDayLogWithId[]>;
      }),
      map((list) => list.map((w) => this.mapWeekLogFromFirestore(w))),
    );
  }

  /** Logs for each weekday for the week starting `weekMonday`. */
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
    await setDoc(
      d,
      {
        weekMondayKey: formatLocalDate(weekMonday),
        dayOfWeek: day,
        exercises: exercises.map((e) => ({
          exerciseKey: e.exerciseKey,
          name: e.name.trim(),
          sets: [Number(e.sets[0]), Number(e.sets[1]), Number(e.sets[2])],
        })),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  /**
   * For each exerciseKey, best weight logged on set 1, set 2, and set 3 (indices 0–2) across all week logs.
   */
  computeBestPerExerciseSet(logs: WeekDayLogWithId[]): Map<string, readonly [number, number, number]> {
    const m = new Map<string, [number, number, number]>();
    for (const log of logs) {
      for (const ex of log.exercises) {
        const s = ex.sets;
        const cur = m.get(ex.exerciseKey) ?? [0, 0, 0];
        m.set(ex.exerciseKey, [
          Math.max(cur[0], s[0]),
          Math.max(cur[1], s[1]),
          Math.max(cur[2], s[2]),
        ]);
      }
    }
    return m;
  }

  listSetPersonalRecords(logs: WeekDayLogWithId[]): { exerciseKey: string; exerciseName: string; setIndex: 1 | 2 | 3; bestKg: number; whenLabel: string }[] {
    const m = new Map<string, { name: string; bests: [number, number, number] }>();
    for (const log of logs) {
      for (const ex of log.exercises) {
        const prev = m.get(ex.exerciseKey);
        const s = ex.sets;
        if (!prev) {
          m.set(ex.exerciseKey, { name: ex.name, bests: [s[0], s[1], s[2]] });
        } else {
          prev.bests = [
            Math.max(prev.bests[0], s[0]),
            Math.max(prev.bests[1], s[1]),
            Math.max(prev.bests[2], s[2]),
          ];
        }
      }
    }
    const rows: { exerciseKey: string; exerciseName: string; setIndex: 1 | 2 | 3; bestKg: number; whenLabel: string }[] = [];
    for (const [exerciseKey, { name, bests }] of m) {
      for (let i = 0; i < 3; i++) {
        rows.push({
          exerciseKey,
          exerciseName: name,
          setIndex: (i + 1) as 1 | 2 | 3,
          bestKg: bests[i],
          whenLabel: 'all weeks',
        });
      }
    }
    return rows.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.setIndex - b.setIndex);
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
            return {
              exerciseKey: typeof o.exerciseKey === 'string' ? o.exerciseKey : crypto.randomUUID(),
              name: String(o.name).trim(),
              ...(notesTrimmed ? { notes: notesTrimmed } : {}),
            };
          })
          .filter((x) => x.name.length > 0);
      }
    }
    return base;
  }

  private mapWeekLogFromFirestore(w: WeekDayLogWithId): WeekDayLogWithId {
    const exercises = (w.exercises ?? []).map((e) => ({
      exerciseKey: e.exerciseKey,
      name: e.name,
      sets: [e.sets[0], e.sets[1], e.sets[2]] as WeekLogExercise['sets'],
    }));
    return {
      id: w.id,
      weekMondayKey: w.weekMondayKey,
      dayOfWeek: w.dayOfWeek as DayOfWeek,
      exercises,
    };
  }

  private sanitizeProgram(program: WeeklyProgram): WeeklyProgram {
    const out: WeeklyProgram = structuredClone(EMPTY_WEEKLY_PROGRAM);
    for (const day of DAYS) {
      out[day] = program[day]
        .map((e) => {
          const name = e.name.trim();
          const notes = e.notes?.trim();
          return {
            exerciseKey: e.exerciseKey,
            name,
            ...(notes ? { notes } : {}),
          };
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
  /** Legacy / alias if you ever stored this key */
  description?: string;
}

import type { DayOfWeek } from '../weekly/weekly-utils';

export type ExerciseKind = 'strength' | 'cardio';

/** One line in the repeating weekly template (stable `exerciseKey` links logs week to week). */
export interface ProgramExercise {
  exerciseKey: string;
  name: string;
  /** Optional cues, form tips, equipment, etc. */
  notes?: string;
  /** Default `strength` if omitted in Firestore (legacy). */
  kind?: ExerciseKind;
  /**
   * Strength only: how many weight sets to log (1–12). Defaults to 3 when missing.
   * Ignored for cardio.
   */
  setCount?: number;
}

/** Mon–Sun template: which exercises you plan on each day (repeats every week). */
export type WeeklyProgram = Record<DayOfWeek, ProgramExercise[]>;

export const EMPTY_WEEKLY_PROGRAM: WeeklyProgram = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
};

/** One exercise row saved for a specific calendar week + weekday. */
export interface WeekLogExercise {
  exerciseKey: string;
  name: string;
  kind: ExerciseKind;
  /** Strength: weights in kg, one entry per set. */
  sets?: number[];
  /** Cardio: duration in minutes (decimals ok, e.g. 0.5 for 30s). */
  durationMinutes?: number | null;
  /** User marked this exercise done for that day (optional in Firestore for older logs). */
  completed?: boolean;
}

export interface WeekDayLog {
  weekMondayKey: string;
  dayOfWeek: DayOfWeek;
  exercises: WeekLogExercise[];
}

export interface WeekDayLogWithId extends WeekDayLog {
  id: string;
}

/** @deprecated use exercise helpers */
export type ExerciseSetBests = Map<string, readonly [number, number, number]>;

export function resolvedExerciseKind(ex: ProgramExercise): ExerciseKind {
  return ex.kind === 'cardio' ? 'cardio' : 'strength';
}

/** Strength set count (1–12). Returns 0 for cardio. */
export function resolvedSetCount(ex: ProgramExercise): number {
  if (resolvedExerciseKind(ex) === 'cardio') return 0;
  const n = ex.setCount ?? 3;
  const r = Math.round(Number(n));
  return Math.min(12, Math.max(1, Number.isFinite(r) && r > 0 ? r : 3));
}

import type { DayOfWeek } from './weekly-utils';

export type ExerciseKind = 'strength' | 'cardio';

export interface ProgramExercise {
  exerciseKey: string;
  name: string;
  notes?: string;
  kind?: ExerciseKind;
  setCount?: number;
}

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

export interface WeekLogExercise {
  exerciseKey: string;
  name: string;
  kind: ExerciseKind;
  sets?: number[];
  durationMinutes?: number | null;
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

export function resolvedExerciseKind(ex: ProgramExercise): ExerciseKind {
  return ex.kind === 'cardio' ? 'cardio' : 'strength';
}

export function resolvedSetCount(ex: ProgramExercise): number {
  if (resolvedExerciseKind(ex) === 'cardio') return 0;
  const n = ex.setCount ?? 3;
  const r = Math.round(Number(n));
  return Math.min(12, Math.max(1, Number.isFinite(r) && r > 0 ? r : 3));
}

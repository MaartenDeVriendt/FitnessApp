import type { WeightTriple } from './fitness.models';
import type { DayOfWeek } from '../weekly/weekly-utils';

/** One line in the repeating weekly template (stable `exerciseKey` links logs week to week). */
export interface ProgramExercise {
  exerciseKey: string;
  name: string;
  /** Optional cues, form tips, equipment, etc. (stored in Firestore on the template). */
  notes?: string;
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
  sets: WeightTriple;
}

export interface WeekDayLog {
  weekMondayKey: string;
  dayOfWeek: DayOfWeek;
  exercises: WeekLogExercise[];
}

export interface WeekDayLogWithId extends WeekDayLog {
  id: string;
}

/** Best kg ever logged per exercise key and set index (0, 1, 2). */
export type ExerciseSetBests = Map<string, readonly [number, number, number]>;

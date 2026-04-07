import type { Timestamp } from 'firebase/firestore';

/** Exactly three set weights in kg (requirement: array of 3 weights). */
export type WeightTriple = readonly [number, number, number];

/**
 * One exercise line inside a workout.
 * - `sets`: current session (3 weights in kg).
 * - `previous`: optional comparison from last time (same shape).
 * - `pr`: optional snapshot stored on the document (e.g. “was a PR when logged”).
 */
export interface ExerciseEntry {
  name: string;
  sets: WeightTriple;
  previous?: WeightTriple;
  pr?: ExercisePrSnapshot;
}

/** Optional PR metadata saved on an exercise entry. */
export interface ExercisePrSnapshot {
  /** Highest weight (kg) considered the PR for this entry. */
  maxKg: number;
  /** ISO 8601 date string when that PR was achieved (optional). */
  achievedAt?: string;
}

/**
 * Workout document in Firestore: `users/{uid}/workouts/{workoutId}`
 * `date` is stored as Firestore Timestamp; this app maps to/from `Date` in the UI layer.
 */
export interface Workout {
  date: Date | Timestamp;
  exercises: ExerciseEntry[];
}

/**
 * Workout with document id after the service maps Firestore `Timestamp` → `Date` for the UI.
 */
export interface WorkoutWithId {
  id: string;
  date: Date;
  exercises: ExerciseEntry[];
}

/**
 * App profile at `users/{uid}` (Auth owns UID; Firestore holds editable fields).
 */
export interface UserProfile {
  uid: string;
  email: string | null;
  /** From sign-up or profile page. */
  displayName?: string | null;
  /** Shown in the header; overrides display name when set. */
  nickname?: string | null;
  bio?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

/**
 * Derived PR for one exercise across all workouts (computed client-side from loaded workouts).
 */
export interface ExercisePersonalRecord {
  exerciseName: string;
  /** Best single-set weight in kg across all workouts for this exercise name. */
  maxKg: number;
  workoutId: string;
  date: Date;
}

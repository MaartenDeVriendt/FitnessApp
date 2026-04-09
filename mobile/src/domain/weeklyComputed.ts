import type { WeekDayLogWithId } from './weekly.models';

/** Strength: per-set best kg across logs. */
export function computeBestPerExerciseSet(logs: WeekDayLogWithId[]): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const log of logs) {
    for (const ex of log.exercises) {
      if (ex.kind === 'cardio' || !ex.sets?.length) continue;
      const cur = m.get(ex.exerciseKey) ?? [];
      const next = [...cur];
      for (let i = 0; i < ex.sets.length; i++) {
        const v = ex.sets[i]!;
        next[i] = Math.max(next[i] ?? 0, v);
      }
      m.set(ex.exerciseKey, next);
    }
  }
  return m;
}

export function computeBestCardioMinutes(logs: WeekDayLogWithId[]): Map<string, number> {
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

export function listSetPersonalRecords(logs: WeekDayLogWithId[]): {
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
        bestKg: bests[i]!,
        whenLabel: 'all weeks',
      });
    }
  }
  return rows.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.setIndex - b.setIndex);
}

export function listCardioPersonalRecords(logs: WeekDayLogWithId[]): {
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

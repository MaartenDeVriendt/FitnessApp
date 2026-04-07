import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { WeeklyService } from '../services/weekly.service';
import {
  EMPTY_WEEKLY_PROGRAM,
  type ProgramExercise,
  type WeeklyProgram,
  type WeekLogExercise,
  resolvedExerciseKind,
  resolvedSetCount,
} from '../models/weekly.models';
import type { DayOfWeek } from '../weekly/weekly-utils';
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
} from '../weekly/weekly-utils';
import type { WeekDayLogWithId } from '../models/weekly.models';
import { FormsModule } from '@angular/forms';

type DraftEntry =
  | { kind: 'strength'; weights: number[]; completed: boolean }
  | { kind: 'cardio'; minutes: number; completed: boolean };

type DraftMap = Record<string, DraftEntry>;

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

@Component({
  selector: 'app-week-view',
  imports: [RouterLink, FormsModule],
  templateUrl: './week-view.component.html',
  styleUrl: './week-view.component.scss',
})
export class WeekViewComponent {
  private readonly weeklyService = inject(WeeklyService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dayStripRef = viewChild<ElementRef<HTMLElement>>('dayStrip');

  /** Debounced writes after editing weights or cardio (ms). */
  private readonly autosaveDelayMs = 800;
  private readonly autosaveTimers = new Map<DayOfWeek, ReturnType<typeof setTimeout>>();

  readonly weekMonday = signal(mondayOfWeekContaining(new Date()));
  readonly selectedDay = signal<DayOfWeek>(dayOfWeekFromDate(new Date()));

  private readonly vm = toSignal(
    toObservable(this.weekMonday).pipe(
      switchMap((mon) =>
        combineLatest([
          this.weeklyService.program$(),
          this.weeklyService.weekLogsForMonday$(mon),
          this.weeklyService.weekLogsForMonday$(addDays(mon, -7)),
        ]).pipe(map(([program, logs, prevLogs]) => ({ mon, program, logs, prevLogs }))),
      ),
    ),
    {
      initialValue: {
        mon: mondayOfWeekContaining(new Date()),
        program: EMPTY_WEEKLY_PROGRAM,
        logs: emptyLogsRecord(),
        prevLogs: emptyLogsRecord(),
      },
    },
  );

  readonly setBests = toSignal(
    this.weeklyService.allWeekLogs$().pipe(map((logs) => this.weeklyService.computeBestPerExerciseSet(logs))),
    { initialValue: new Map<string, number[]>() },
  );

  readonly cardioBests = toSignal(
    this.weeklyService.allWeekLogs$().pipe(map((logs) => this.weeklyService.computeBestCardioMinutes(logs))),
    { initialValue: new Map<string, number>() },
  );

  readonly draft = signal<DraftMap>({});
  readonly savingDay = signal<DayOfWeek | null>(null);

  readonly days = DAYS;
  dayLabel = dayLabel;
  shortDayLabel = shortDayLabel;
  resolvedExerciseKind = resolvedExerciseKind;
  resolvedSetCount = resolvedSetCount;

  constructor() {
    effect(() => {
      const v = this.vm();
      if (!v) return;
      this.rebuildDraft(v.program, v.logs);
    });

    effect(() => {
      this.selectedDay();
      this.weekMonday();
      untracked(() => queueMicrotask(() => this.scrollActiveDayIntoView()));
    });

    afterNextRender(() => this.scrollActiveDayIntoView());

    effect(() => {
      this.weekMonday();
      untracked(() => this.clearAllAutosaveTimers());
    });

    this.destroyRef.onDestroy(() => this.clearAllAutosaveTimers());
  }

  private clearAutosaveTimer(day: DayOfWeek): void {
    const t = this.autosaveTimers.get(day);
    if (t) {
      clearTimeout(t);
      this.autosaveTimers.delete(day);
    }
  }

  private clearAllAutosaveTimers(): void {
    for (const t of this.autosaveTimers.values()) clearTimeout(t);
    this.autosaveTimers.clear();
  }

  /** Queue a Firestore write after the user pauses editing (weights / cardio only). */
  private queueAutosave(day: DayOfWeek): void {
    if (this.program()[day].length === 0) return;
    const weekKey = formatLocalDate(this.weekMonday());
    this.clearAutosaveTimer(day);
    const t = setTimeout(() => {
      this.autosaveTimers.delete(day);
      if (formatLocalDate(this.weekMonday()) !== weekKey) return;
      void this.autosaveDay(day);
    }, this.autosaveDelayMs);
    this.autosaveTimers.set(day, t);
  }

  private async autosaveDay(day: DayOfWeek): Promise<void> {
    try {
      await this.persistDay(day);
    } catch (e) {
      console.error('Auto-save failed', e);
    }
  }

  setIndexes(ex: ProgramExercise): number[] {
    const n = resolvedSetCount(ex);
    return Array.from({ length: n }, (_, i) => i);
  }

  selectDay(day: DayOfWeek): void {
    this.selectedDay.set(day);
  }

  chipDateLabel(day: DayOfWeek): string {
    return dateForWeekday(this.weekMonday(), day).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }

  isChipToday(day: DayOfWeek): boolean {
    return formatLocalDate(dateForWeekday(this.weekMonday(), day)) === formatLocalDate(new Date());
  }

  weekRangeLabel(): string {
    const mon = this.weekMonday();
    const sun = sundayOfWeek(mon);
    return `${formatLocalDate(mon)} → ${formatLocalDate(sun)}`;
  }

  prevWeek(): void {
    this.weekMonday.update((m) => addDays(m, -7));
  }

  nextWeek(): void {
    this.weekMonday.update((m) => addDays(m, 7));
  }

  goToToday(): void {
    const today = new Date();
    this.weekMonday.set(mondayOfWeekContaining(today));
    this.selectedDay.set(dayOfWeekFromDate(today));
  }

  program(): WeeklyProgram {
    return this.vm()?.program ?? EMPTY_WEEKLY_PROGRAM;
  }

  logsForDay(day: DayOfWeek): WeekDayLogWithId | null {
    return this.vm()?.logs[day] ?? null;
  }

  prevLogsForDay(day: DayOfWeek): WeekDayLogWithId | null {
    return this.vm()?.prevLogs[day] ?? null;
  }

  draftKey(day: DayOfWeek, exerciseKey: string): string {
    return `${day}_${exerciseKey}`;
  }

  getStrengthWeight(day: DayOfWeek, ex: ProgramExercise, setIdx: number): number {
    const e = this.draft()[this.draftKey(day, ex.exerciseKey)];
    if (e?.kind !== 'strength') return 0;
    return e.weights[setIdx] ?? 0;
  }

  setStrengthWeight(day: DayOfWeek, ex: ProgramExercise, setIdx: number, value: number | string): void {
    const key = this.draftKey(day, ex.exerciseKey);
    const n = resolvedSetCount(ex);
    const num = typeof value === 'string' ? parseFloat(value) : value;
    const v = Number.isFinite(num) ? num : 0;
    this.draft.update((m) => {
      const cur = m[key];
      let weights: number[] = cur?.kind === 'strength' ? [...cur.weights] : Array(n).fill(0);
      while (weights.length < n) weights.push(0);
      weights[setIdx] = v;
      const done = cur?.kind === 'strength' ? cur.completed : false;
      return { ...m, [key]: { kind: 'strength', weights, completed: done } };
    });
    this.queueAutosave(day);
  }

  getCardioMinutes(day: DayOfWeek, ex: ProgramExercise): number {
    const e = this.draft()[this.draftKey(day, ex.exerciseKey)];
    if (e?.kind !== 'cardio') return 0;
    return e.minutes;
  }

  setCardioMinutes(day: DayOfWeek, ex: ProgramExercise, value: number | string): void {
    const key = this.draftKey(day, ex.exerciseKey);
    const num = typeof value === 'string' ? parseFloat(value) : value;
    const minutes = Number.isFinite(num) ? num : 0;
    const cur = this.draft()[key];
    const done = cur?.kind === 'cardio' ? cur.completed : false;
    this.draft.update((m) => ({ ...m, [key]: { kind: 'cardio', minutes, completed: done } }));
    this.queueAutosave(day);
  }

  lastWeekSetKg(day: DayOfWeek, exerciseKey: string, setIdx: number): number | null {
    const prev = this.prevLogsForDay(day);
    const ex = prev?.exercises.find((e) => e.exerciseKey === exerciseKey);
    if (!ex || ex.kind === 'cardio' || !ex.sets?.length) return null;
    const v = ex.sets[setIdx];
    return v != null ? v : null;
  }

  lastWeekCardioMinutes(day: DayOfWeek, exerciseKey: string): number | null {
    const prev = this.prevLogsForDay(day);
    const ex = prev?.exercises.find((e) => e.exerciseKey === exerciseKey);
    if (!ex || ex.kind !== 'cardio' || ex.durationMinutes == null || !Number.isFinite(ex.durationMinutes)) {
      return null;
    }
    return ex.durationMinutes;
  }

  bestEverSetKg(exerciseKey: string, setIdx: number): number | null {
    const row = this.setBests().get(exerciseKey);
    if (!row) return null;
    const v = row[setIdx];
    return v != null && v > 0 ? v : null;
  }

  bestCardioMinutes(exerciseKey: string): number | null {
    const v = this.cardioBests().get(exerciseKey);
    return v != null && v > 0 ? v : null;
  }

  isExerciseComplete(day: DayOfWeek, ex: ProgramExercise): boolean {
    const d = this.draft()[this.draftKey(day, ex.exerciseKey)];
    return d?.completed === true;
  }

  /** Program order: not completed first, then completed (stable within each group). */
  exercisesSortedForDay(day: DayOfWeek): ProgramExercise[] {
    const prog = this.program()[day];
    const incomplete = prog.filter((ex) => !this.isExerciseComplete(day, ex));
    const complete = prog.filter((ex) => this.isExerciseComplete(day, ex));
    return [...incomplete, ...complete];
  }

  /** First index in `sorted` where the exercise is completed, or -1 if none. */
  firstCompletedSortIndex(sorted: ProgramExercise[], day: DayOfWeek): number {
    return sorted.findIndex((ex) => this.isExerciseComplete(day, ex));
  }

  /** Highlights the next exercise to do (first incomplete in display order). */
  isNextUp(day: DayOfWeek, ex: ProgramExercise): boolean {
    const sorted = this.exercisesSortedForDay(day);
    const next = sorted.find((e) => !this.isExerciseComplete(day, e));
    return next !== undefined && next.exerciseKey === ex.exerciseKey;
  }

  async toggleExerciseComplete(day: DayOfWeek, ex: ProgramExercise): Promise<void> {
    const key = this.draftKey(day, ex.exerciseKey);
    const before = this.draft()[key];
    if (!before) return;
    const nextCompleted = !before.completed;
    this.draft.update((m) => {
      const cur = m[key];
      if (!cur) return m;
      return { ...m, [key]: { ...cur, completed: nextCompleted } };
    });
    try {
      await this.persistDay(day);
    } catch {
      this.draft.update((m) => {
        const cur = m[key];
        if (!cur) return m;
        return { ...m, [key]: { ...cur, completed: before.completed } };
      });
    }
  }

  async saveDay(day: DayOfWeek): Promise<void> {
    const prog = this.program()[day];
    if (prog.length === 0) return;
    this.clearAutosaveTimer(day);
    this.savingDay.set(day);
    try {
      await this.persistDay(day);
    } finally {
      this.savingDay.set(null);
    }
  }

  private logExercisesFromDraft(day: DayOfWeek): WeekLogExercise[] {
    const prog = this.program()[day];
    return prog.map((ex) => {
      const key = this.draftKey(day, ex.exerciseKey);
      const d = this.draft()[key];
      const completed = d?.completed === true;
      if (resolvedExerciseKind(ex) === 'cardio') {
        const minutes = d?.kind === 'cardio' ? d.minutes : 0;
        return {
          exerciseKey: ex.exerciseKey,
          name: ex.name,
          kind: 'cardio' as const,
          durationMinutes: Number.isFinite(minutes) ? minutes : 0,
          ...(completed ? { completed: true } : {}),
        };
      }
      const n = resolvedSetCount(ex);
      const weights = d?.kind === 'strength' ? [...d.weights] : Array(n).fill(0);
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

  private async persistDay(day: DayOfWeek): Promise<void> {
    this.clearAutosaveTimer(day);
    const exercises = this.logExercisesFromDraft(day);
    await this.weeklyService.saveWeekDayLog(this.weekMonday(), day, exercises);
  }

  private scrollActiveDayIntoView(): void {
    const strip = this.dayStripRef()?.nativeElement;
    if (!strip) return;
    const d = this.selectedDay();
    const chip = strip.querySelector<HTMLElement>(`[data-day="${d}"]`);
    chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  private rebuildDraft(program: WeeklyProgram, logs: Record<DayOfWeek, WeekDayLogWithId | null>): void {
    const next: DraftMap = {};
    for (const d of DAYS) {
      const log = logs[d];
      for (const ex of program[d]) {
        const key = this.draftKey(d, ex.exerciseKey);
        const found = log?.exercises.find((e) => e.exerciseKey === ex.exerciseKey);
        const completed = found?.completed === true;
        if (resolvedExerciseKind(ex) === 'cardio') {
          let minutes = 0;
          if (
            found?.kind === 'cardio' &&
            found.durationMinutes != null &&
            Number.isFinite(found.durationMinutes)
          ) {
            minutes = found.durationMinutes;
          }
          next[key] = { kind: 'cardio', minutes, completed };
        } else {
          const n = resolvedSetCount(ex);
          const weights = Array(n).fill(0);
          if (found?.kind === 'strength' && found.sets?.length) {
            for (let i = 0; i < n; i++) {
              weights[i] = found.sets[i] ?? 0;
            }
          }
          next[key] = { kind: 'strength', weights, completed };
        }
      }
    }
    this.draft.set(next);
  }
}

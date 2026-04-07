import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, switchMap } from 'rxjs';
import { map } from 'rxjs/operators';
import { WeeklyService } from '../services/weekly.service';
import { EMPTY_WEEKLY_PROGRAM, type WeeklyProgram } from '../models/weekly.models';
import type { DayOfWeek } from '../weekly/weekly-utils';
import {
  DAYS,
  addDays,
  dayLabel,
  formatLocalDate,
  mondayOfWeekContaining,
  sundayOfWeek,
} from '../weekly/weekly-utils';
import type { WeekDayLogWithId } from '../models/weekly.models';
import { FormsModule } from '@angular/forms';

type DraftMap = Record<string, [number, number, number]>;

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

  /** Monday 00:00 local for the week being edited. */
  readonly weekMonday = signal(mondayOfWeekContaining(new Date()));

  /** Program + this week’s logs + previous week’s logs for the selected Monday. */
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

  /** Best kg on set 1 / 2 / 3 per exerciseKey across all logged weeks. */
  readonly setBests = toSignal(
    this.weeklyService.allWeekLogs$().pipe(map((logs) => this.weeklyService.computeBestPerExerciseSet(logs))),
    { initialValue: new Map<string, readonly [number, number, number]>() },
  );

  /** Local editable weights: key `${day}_${exerciseKey}` → [set1, set2, set3] kg. */
  readonly draft = signal<DraftMap>({});

  readonly savingDay = signal<DayOfWeek | null>(null);

  constructor() {
    effect(() => {
      const v = this.vm();
      if (!v) return;
      this.rebuildDraft(v.program, v.logs);
    });
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

  thisWeek(): void {
    this.weekMonday.set(mondayOfWeekContaining(new Date()));
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

  getWeight(day: DayOfWeek, exerciseKey: string, setIdx: 0 | 1 | 2): number {
    const key = this.draftKey(day, exerciseKey);
    return this.draft()[key]?.[setIdx] ?? 0;
  }

  setWeight(day: DayOfWeek, exerciseKey: string, setIdx: 0 | 1 | 2, value: number | string): void {
    const key = this.draftKey(day, exerciseKey);
    const cur = this.draft()[key] ?? [0, 0, 0];
    const next: [number, number, number] = [...cur] as [number, number, number];
    const n = typeof value === 'string' ? parseFloat(value) : value;
    next[setIdx] = Number.isFinite(n) ? n : 0;
    this.draft.update((d) => ({ ...d, [key]: next }));
  }

  lastWeekSetKg(day: DayOfWeek, exerciseKey: string, setIdx: 0 | 1 | 2): number | null {
    const prev = this.prevLogsForDay(day);
    const ex = prev?.exercises.find((e) => e.exerciseKey === exerciseKey);
    if (!ex) return null;
    return ex.sets[setIdx];
  }

  bestEverSetKg(exerciseKey: string, setIdx: 0 | 1 | 2): number | null {
    const row = this.setBests().get(exerciseKey);
    if (!row) return null;
    const v = row[setIdx];
    return v > 0 ? v : null;
  }

  async saveDay(day: DayOfWeek): Promise<void> {
    const prog = this.program()[day];
    if (prog.length === 0) return;
    this.savingDay.set(day);
    try {
      const exercises = prog.map((ex) => ({
        exerciseKey: ex.exerciseKey,
        name: ex.name,
        sets: [
          this.getWeight(day, ex.exerciseKey, 0),
          this.getWeight(day, ex.exerciseKey, 1),
          this.getWeight(day, ex.exerciseKey, 2),
        ] as const,
      }));
      await this.weeklyService.saveWeekDayLog(this.weekMonday(), day, exercises);
    } finally {
      this.savingDay.set(null);
    }
  }

  readonly days = DAYS;

  dayLabel = dayLabel;

  private rebuildDraft(program: WeeklyProgram, logs: Record<DayOfWeek, WeekDayLogWithId | null>): void {
    const next: DraftMap = {};
    for (const day of DAYS) {
      const log = logs[day];
      for (const ex of program[day]) {
        const key = this.draftKey(day, ex.exerciseKey);
        const found = log?.exercises.find((e) => e.exerciseKey === ex.exerciseKey);
        next[key] = found ? [found.sets[0], found.sets[1], found.sets[2]] : [0, 0, 0];
      }
    }
    this.draft.set(next);
  }
}

interface Vm {
  mon: Date;
  program: WeeklyProgram;
  logs: Record<DayOfWeek, WeekDayLogWithId | null>;
  prevLogs: Record<DayOfWeek, WeekDayLogWithId | null>;
}

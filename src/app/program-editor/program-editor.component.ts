import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WeeklyService } from '../services/weekly.service';
import {
  EMPTY_WEEKLY_PROGRAM,
  type ExerciseKind,
  type ProgramExercise,
  type WeeklyProgram,
} from '../models/weekly.models';
import { DAYS, dayLabel, type DayOfWeek } from '../weekly/weekly-utils';

@Component({
  selector: 'app-program-editor',
  imports: [RouterLink, FormsModule],
  templateUrl: './program-editor.component.html',
  styleUrl: './program-editor.component.scss',
})
export class ProgramEditorComponent implements OnInit {
  private readonly weeklyService = inject(WeeklyService);
  private readonly destroyRef = inject(DestroyRef);

  draft = signal<WeeklyProgram>(structuredClone(EMPTY_WEEKLY_PROGRAM));
  busy = signal(false);
  message = signal<string | null>(null);

  readonly days = DAYS;
  dayLabel = dayLabel;

  readonly kinds: { id: ExerciseKind; label: string }[] = [
    { id: 'strength', label: 'Strength (weights)' },
    { id: 'cardio', label: 'Cardio (duration)' },
  ];

  ngOnInit(): void {
    this.weeklyService
      .program$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => this.draft.set(structuredClone(p)));
  }

  addExercise(day: DayOfWeek): void {
    const row: ProgramExercise = {
      exerciseKey: crypto.randomUUID(),
      name: '',
      notes: '',
      kind: 'strength',
      setCount: 3,
    };
    this.draft.update((d) => ({
      ...d,
      [day]: [...d[day], row],
    }));
  }

  removeExercise(day: DayOfWeek, exerciseKey: string): void {
    this.draft.update((d) => ({
      ...d,
      [day]: d[day].filter((e) => e.exerciseKey !== exerciseKey),
    }));
  }

  updateName(day: DayOfWeek, exerciseKey: string, name: string): void {
    this.draft.update((d) => ({
      ...d,
      [day]: d[day].map((e) => (e.exerciseKey === exerciseKey ? { ...e, name } : e)),
    }));
  }

  updateNotes(day: DayOfWeek, exerciseKey: string, notes: string): void {
    this.draft.update((d) => ({
      ...d,
      [day]: d[day].map((e) => (e.exerciseKey === exerciseKey ? { ...e, notes } : e)),
    }));
  }

  updateKind(day: DayOfWeek, exerciseKey: string, kind: ExerciseKind): void {
    this.draft.update((d) => ({
      ...d,
      [day]: d[day].map((e) => {
        if (e.exerciseKey !== exerciseKey) return e;
        if (kind === 'cardio') {
          const { setCount: _, ...rest } = e;
          return { ...rest, kind: 'cardio' };
        }
        return { ...e, kind: 'strength', setCount: e.setCount ?? 3 };
      }),
    }));
  }

  updateSetCount(day: DayOfWeek, exerciseKey: string, count: number): void {
    const n = Math.min(12, Math.max(1, Math.round(Number(count)) || 3));
    this.draft.update((d) => ({
      ...d,
      [day]: d[day].map((e) => (e.exerciseKey === exerciseKey ? { ...e, setCount: n } : e)),
    }));
  }

  async save(): Promise<void> {
    this.message.set(null);
    this.busy.set(true);
    try {
      await this.weeklyService.saveProgram(this.draft());
      this.message.set('Saved. Your week template will repeat every week.');
    } catch (e: unknown) {
      this.message.set(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      this.busy.set(false);
    }
  }
}

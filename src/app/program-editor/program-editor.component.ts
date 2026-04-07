import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WeeklyService } from '../services/weekly.service';
import { EMPTY_WEEKLY_PROGRAM, type ProgramExercise, type WeeklyProgram } from '../models/weekly.models';
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

  ngOnInit(): void {
    this.weeklyService
      .program$()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => this.draft.set(structuredClone(p)));
  }

  addExercise(day: DayOfWeek): void {
    const name = prompt('Exercise name?');
    if (!name?.trim()) return;
    const row: ProgramExercise = { exerciseKey: crypto.randomUUID(), name: name.trim() };
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

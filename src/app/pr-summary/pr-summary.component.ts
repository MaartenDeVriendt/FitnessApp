import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { WeeklyService } from '../services/weekly.service';

/**
 * Best weight logged on each set (1–3) per exercise, across all week logs.
 */
@Component({
  selector: 'app-pr-summary',
  imports: [],
  templateUrl: './pr-summary.component.html',
  styleUrl: './pr-summary.component.scss',
})
export class PrSummaryComponent {
  private readonly weeklyService = inject(WeeklyService);

  readonly records = toSignal(
    this.weeklyService.allWeekLogs$().pipe(map((logs) => this.weeklyService.listSetPersonalRecords(logs))),
    { initialValue: [] },
  );
}

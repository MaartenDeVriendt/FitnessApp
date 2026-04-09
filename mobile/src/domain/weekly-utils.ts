export function mondayOfWeekContaining(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, days: number): Date {
  const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  n.setHours(0, 0, 0, 0);
  return n;
}

export function weekLogDocId(weekMonday: Date, dayOfWeek: DayOfWeek): string {
  return `${formatLocalDate(weekMonday)}_${dayOfWeek}`;
}

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export type DayOfWeek = (typeof DAYS)[number];

export function dayLabel(day: DayOfWeek): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export function shortDayLabel(day: DayOfWeek): string {
  return dayLabel(day).slice(0, 3);
}

export function dayOfWeekFromDate(date: Date): DayOfWeek {
  const map: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[date.getDay()]!;
}

export function dateForWeekday(weekMonday: Date, day: DayOfWeek): Date {
  return addDays(weekMonday, DAYS.indexOf(day));
}

export function sundayOfWeek(monday: Date): Date {
  return addDays(monday, 6);
}

/** Local Monday 00:00 for the calendar week containing `date` (Mon–Sun weeks). */
export function mondayOfWeekContaining(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0 Sun … 6 Sat
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

/** Firestore document id: `{weekMondayKey}_{dayOfWeek}` e.g. `2026-04-06_monday`. */
export function weekLogDocId(weekMonday: Date, dayOfWeek: DayOfWeek): string {
  return `${formatLocalDate(weekMonday)}_${dayOfWeek}`;
}

export function parseWeekLogDocId(id: string): { weekMondayKey: string; dayOfWeek: DayOfWeek } | null {
  const parts = id.split('_');
  if (parts.length < 2) return null;
  const day = parts[parts.length - 1] as DayOfWeek;
  const weekMondayKey = parts.slice(0, -1).join('_');
  if (!DAYS.includes(day)) return null;
  return { weekMondayKey, dayOfWeek: day };
}

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export type DayOfWeek = (typeof DAYS)[number];

export function dayLabel(day: DayOfWeek): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/** Sunday end date for header range (Mon–Sun). */
export function sundayOfWeek(monday: Date): Date {
  return addDays(monday, 6);
}

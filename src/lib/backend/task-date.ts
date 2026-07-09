import * as chrono from 'chrono-node';

export function parseDate(input: string, referenceDate?: Date): Date | null {
  if (!input || !input.trim()) return null;
  const ref = referenceDate || new Date();
  const results = chrono.parse(input, ref);
  if (results.length === 0) return null;
  return results[0].start.date();
}

export function parseDateString(input: string, referenceDate?: Date): string | null {
  const d = parseDate(input, referenceDate);
  if (!d) return null;
  return d.toISOString().split('T')[0];
}

export function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

const RECUR_RE = /^(daily|weekly|monthly|yearly):(\d+)$/;

export function parseRecurrence(recur: string): { interval: string; count: number } | null {
  const m = recur.match(RECUR_RE);
  if (!m) return null;
  return { interval: m[1], count: parseInt(m[2], 10) };
}

export function isValidRecurrence(recur: string): boolean {
  return RECUR_RE.test(recur);
}

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonthsClampedUTC(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonth = d.getUTCMonth() + months;
  d.setUTCMonth(targetMonth);
  if (d.getUTCMonth() !== ((targetMonth % 12) + 12) % 12) {
    d.setUTCDate(0);
  }
  return d;
}

function addYearsClampedUTC(date: Date, years: number): Date {
  const d = new Date(date);
  const origMonth = d.getUTCMonth();
  d.setUTCFullYear(d.getUTCFullYear() + years);
  if (d.getUTCMonth() !== origMonth) {
    d.setUTCDate(0);
  }
  return d;
}

export function advanceDue(
  currentDue: string,
  recur: string,
  fromDate?: Date,
): string {
  const parsed = parseRecurrence(recur);
  if (!parsed) return currentDue;

  let refDate: Date;
  if (fromDate) {
    refDate = fromDate;
  } else {
    const parsedDue = currentDue
      ? new Date(currentDue + 'T00:00:00')
      : null;
    refDate = parsedDue && !isNaN(parsedDue.getTime())
      ? parsedDue
      : new Date();
  }

  const { interval, count } = parsed;

  switch (interval) {
    case 'daily': {
      const next = addDaysUTC(refDate, count);
      return formatISODate(next);
    }
    case 'weekly': {
      const next = addDaysUTC(refDate, count * 7);
      return formatISODate(next);
    }
    case 'monthly': {
      const next = addMonthsClampedUTC(refDate, count);
      return formatISODate(next);
    }
    case 'yearly': {
      const next = addYearsClampedUTC(refDate, count);
      return formatISODate(next);
    }
    default:
      return currentDue;
  }
}

export function dateToJournalLink(date: string): string {
  return `[[Journal/${date}]]`;
}

export function isBeforeToday(dateStr: string): boolean {
  if (!dateStr) return false;
  return dateStr < todayString();
}

export function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  return dateStr === todayString();
}

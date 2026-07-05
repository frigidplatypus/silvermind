import { describe, it, expect } from 'vitest';
import { parseDate, parseRecurrence, isValidRecurrence, advanceDue, isBeforeToday, isToday } from '../task-date';

describe('parseDate', () => {
  it('parses "tomorrow"', () => {
    const ref = new Date('2026-06-30');
    const result = parseDate('tomorrow', ref);
    expect(result).not.toBeNull();
    expect(result!.toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  it('parses "next monday"', () => {
    const ref = new Date('2026-06-30'); // Tuesday
    const result = parseDate('next monday', ref);
    expect(result).not.toBeNull();
    const day = result!.getDay();
    expect(day).toBe(1); // Monday
  });

  it('parses "in 3 days"', () => {
    const ref = new Date('2026-06-30');
    const result = parseDate('in 3 days', ref);
    expect(result).not.toBeNull();
    expect(result!.toISOString().slice(0, 10)).toBe('2026-07-03');
  });

  it('returns null for empty input', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('   ')).toBeNull();
  });
});

describe('parseRecurrence', () => {
  it('parses daily recurrence', () => {
    expect(parseRecurrence('daily:1')).toEqual({ interval: 'daily', count: 1 });
  });

  it('parses weekly recurrence', () => {
    expect(parseRecurrence('weekly:2')).toEqual({ interval: 'weekly', count: 2 });
  });

  it('parses monthly recurrence', () => {
    expect(parseRecurrence('monthly:1')).toEqual({ interval: 'monthly', count: 1 });
  });

  it('parses yearly recurrence', () => {
    expect(parseRecurrence('yearly:1')).toEqual({ interval: 'yearly', count: 1 });
  });

  it('returns null for invalid format', () => {
    expect(parseRecurrence('daily')).toBeNull();
    expect(parseRecurrence('invalid:1')).toBeNull();
    expect(parseRecurrence('')).toBeNull();
  });
});

describe('isValidRecurrence', () => {
  it('validates correct recurrence strings', () => {
    expect(isValidRecurrence('daily:1')).toBe(true);
    expect(isValidRecurrence('monthly:2')).toBe(true);
  });

  it('rejects invalid recurrence strings', () => {
    expect(isValidRecurrence('daily')).toBe(false);
    expect(isValidRecurrence('hourly:1')).toBe(false);
  });
});

describe('advanceDue', () => {
  it('advances daily recurrence', () => {
    const result = advanceDue('2026-06-30', 'daily:1', new Date('2026-06-30'));
    expect(result).toBe('2026-07-01');
  });

  it('advances weekly recurrence', () => {
    const result = advanceDue('2026-06-30', 'weekly:1', new Date('2026-06-30'));
    expect(result).toBe('2026-07-07');
  });

  it('advances monthly recurrence', () => {
    const result = advanceDue('2026-06-30', 'monthly:1', new Date('2026-06-30'));
    expect(result).toBe('2026-07-30');
  });

  it('handles month boundary clamp (Jan 31 → Feb 28)', () => {
    const result = advanceDue('2026-01-31', 'monthly:1', new Date('2026-01-31'));
    expect(result).toBe('2026-02-28');
  });

  it('handles leap year advance', () => {
    const result = advanceDue('2024-02-29', 'yearly:1', new Date('2024-02-29'));
    expect(result).toBe('2025-02-28'); // 2025 not leap year
  });

  it('advances yearly recurrence', () => {
    const result = advanceDue('2026-06-30', 'yearly:1', new Date('2026-06-30'));
    expect(result).toBe('2027-06-30');
  });
});

describe('isBeforeToday', () => {
  it('detects dates before today', () => {
    expect(isBeforeToday('2020-01-01')).toBe(true);
  });

  it('detects today is not before today', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isBeforeToday(today)).toBe(false);
  });
});

describe('isToday', () => {
  it('detects today', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isToday(today)).toBe(true);
  });

  it('rejects non-today dates', () => {
    expect(isToday('2020-01-01')).toBe(false);
  });
});

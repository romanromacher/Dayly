import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isoWeekOf, isValidDate, mondayOf, todayBerlin, weekKey, weekdayIndex } from '../lib/domain/dates';

describe('dates', () => {
  it('rechnet Tage über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(diffDays('2026-04-22', '2026-05-13')).toBe(21);
  });

  it('bleibt bei Zeitumstellung stabil', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('findet den Montag', () => {
    expect(mondayOf('2026-10-25')).toBe('2026-10-19'); // Sonntag
    expect(mondayOf('2026-10-26')).toBe('2026-10-26'); // Montag
    expect(weekdayIndex('2026-10-25')).toBe(6);
  });

  it('berechnet ISO-Wochen inklusive Jahreswechsel', () => {
    expect(isoWeekOf('2026-10-26')).toEqual({ year: 2026, week: 44 });
    expect(isoWeekOf('2026-04-22')).toEqual({ year: 2026, week: 17 });
    expect(isoWeekOf('2026-12-28')).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf('2027-01-03')).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf('2027-01-04')).toEqual({ year: 2027, week: 1 });
    expect(isoWeekOf('2024-12-30')).toEqual({ year: 2025, week: 1 });
    expect(isoWeekOf('2021-01-01')).toEqual({ year: 2020, week: 53 });
    expect(weekKey('2026-04-22')).toBe('2026-W17');
  });

  it('prüft Datumsangaben streng', () => {
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2024-02-29')).toBe(true);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('26-01-01')).toBe(false);
  });

  it('nimmt den Kalendertag in Europe/Berlin', () => {
    // 23:30 UTC am 24.10. ist in Berlin (MESZ, UTC+2) schon der 25.10.
    expect(todayBerlin(new Date('2026-10-24T23:30:00Z'))).toBe('2026-10-25');
    // Nach der Umstellung (MEZ, UTC+1) ist 23:30 UTC schon der Folgetag, 22:30 UTC noch nicht
    expect(todayBerlin(new Date('2026-10-26T22:30:00Z'))).toBe('2026-10-26');
    expect(todayBerlin(new Date('2026-10-26T23:30:00Z'))).toBe('2026-10-27');
  });
});

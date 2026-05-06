import { RRule, rrulestr } from 'rrule';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

// Expand a recurring event's RRULE string into concrete occurrence timestamps (UTC ms)
// within [rangeStart, rangeEnd].
export function expandRecurrences(
  rruleString: string,
  eventStartUtcMs: number,
  rangeStart: Date,
  rangeEnd: Date,
): number[] {
  try {
    const rule = rrulestr(rruleString, { dtstart: new Date(eventStartUtcMs) });
    return rule
      .between(rangeStart, rangeEnd, true)
      .map((d) => d.getTime());
  } catch {
    return [];
  }
}

// Build an RRULE string from human-readable options.
export type RecurrenceOptions = {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  until?: Date;
  count?: number;
  byweekday?: number[];
};

export function buildRRule(options: RecurrenceOptions): string {
  const freqMap = {
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
    yearly: RRule.YEARLY,
  };

  const rule = new RRule({
    freq: freqMap[options.freq],
    interval: options.interval ?? 1,
    until: options.until,
    count: options.count,
    byweekday: options.byweekday,
  });

  return rule.toString();
}

// Check whether a given UTC timestamp falls on an occurrence of the RRULE.
export function isOccurrence(
  rruleString: string,
  eventStartUtcMs: number,
  checkUtcMs: number,
): boolean {
  try {
    const rule = rrulestr(rruleString, { dtstart: new Date(eventStartUtcMs) });
    const checkDate = new Date(checkUtcMs);
    return rule.between(
      dayjs.utc(checkDate).startOf('day').toDate(),
      dayjs.utc(checkDate).endOf('day').toDate(),
      true,
    ).length > 0;
  } catch {
    return false;
  }
}

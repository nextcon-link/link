import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

// Convert a local date string ('YYYY-MM-DD') + hour/minute to a UTC Unix ms timestamp.
export function toUtcMs(dateString: string, hour: number, minute: number): number {
  return dayjs(`${dateString}T${pad(hour)}:${pad(minute)}:00`).valueOf();
}

// Convert a UTC Unix ms timestamp to a local 'YYYY-MM-DD' date string.
export function toLocalDateString(utcMs: number): string {
  return dayjs(utcMs).format("YYYY-MM-DD");
}

// Get the start (00:00:00 local) and end (23:59:59 local) of a day as UTC ms.
export function dayBounds(dateString: string): { start: number; end: number } {
  const base = dayjs(dateString);
  return {
    start: base.startOf("day").valueOf(),
    end: base.endOf("day").valueOf(),
  };
}

// Get the Sunday-to-Saturday week bounds for a given date.
export function weekBounds(dateString: string): { start: Date; end: Date } {
  const base = dayjs(dateString);
  const startOffset = base.day();
  const start = base.subtract(startOffset, "day").startOf("day");
  const end = start.add(6, "day").endOf("day");
  return { start: start.toDate(), end: end.toDate() };
}

// Get the first and last day of the month containing the given date.
export function monthBounds(dateString: string): { start: Date; end: Date } {
  const base = dayjs(dateString);
  return {
    start: base.startOf("month").toDate(),
    end: base.endOf("month").toDate(),
  };
}

// Format a Unix ms timestamp for display (e.g., "14:30").
export function formatTime(utcMs: number): string {
  return dayjs(utcMs).format("HH:mm");
}

export function formatKoreanDate(utcMs: number): string {
  const d = dayjs(utcMs);
  return `${d.year()}년 ${d.month() + 1}월 ${d.date()}일`;
}

// Convert a local dayjs instance to ISO 8601 UTC string for Supabase writes.
export function toIsoUtc(localDayjs: dayjs.Dayjs): string {
  return localDayjs.utc().toISOString();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export type CalendarEntrySource = "home" | "shared";

let calendarEntrySource: CalendarEntrySource | null = null;

export function allowCalendarEntry(source: CalendarEntrySource) {
  calendarEntrySource = source;
}

export function getCalendarEntrySource() {
  return calendarEntrySource;
}

export function clearCalendarEntry() {
  calendarEntrySource = null;
}

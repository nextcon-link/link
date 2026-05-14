export type EventFormInput = {
  title: string;
  date: string;           // YYYY-MM-DD local
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  target: EventFormTarget;
  labelId: string | null;
  recurrenceRule: string | null;  // iCal RRULE string, e.g. "FREQ=WEEKLY"
  sharingMode: sharingMode;
};

export type EventFormTarget =
  | { type: 'local' }
  | { type: 'device'; calendarId: string };

export type sharingMode = 'none' | 'visible' | 'invisible' | 'blind';

export type LabelFormInput = {
  name: string;
  color: string;          // hex color, e.g. "#FF5733"
  sharingMode: sharingMode;
};

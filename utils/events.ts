export type EventFormInput = {
  title: string;
  date: string;           // YYYY-MM-DD local
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  labelId: string | null;
  recurrenceRule: string | null;  // iCal RRULE string, e.g. "FREQ=WEEKLY"
};

export type LabelFormInput = {
  name: string;
  color: string;          // hex color, e.g. "#FF5733"
};

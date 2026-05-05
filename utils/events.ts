export type LabelType = "normal" | "blind" | "private";

export type LabelItem = {
  id: string;
  name: string;
  type: LabelType;
};

export type LabelsById = {
  [labelId: string]: LabelItem;
};

export type EventItem = {
  id: string;
  title: string;
  date: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  labelId?: string | null;
};

export type EventsByWeek = {
  [weekKey: string]: {
    [eventId: string]: EventItem;
  };
};
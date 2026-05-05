import { getWeekKey } from "./date";
import type { EventItem } from "./events";
import { loadEvents, saveEvents } from "./storage";

type EventInput = {
  title: string;
  date: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  labelId: string | null;
};

function getTotalMinutes(hour: number, minute: number) {
  return hour * 60 + minute;
}

export function isValidEventTime(input: EventInput) {
  const startTotal = getTotalMinutes(input.startHour, input.startMinute);
  const endTotal = getTotalMinutes(input.endHour, input.endMinute);

  return endTotal > startTotal;
}

export async function hasEventOverlap(
  input: EventInput,
  ignoreEventId?: string,
) {
  const allEvents = await loadEvents();
  const weekKey = getWeekKey(input.date);
  const weekEvents = allEvents[weekKey] || {};

  const startTotal = getTotalMinutes(input.startHour, input.startMinute);
  const endTotal = getTotalMinutes(input.endHour, input.endMinute);

  return Object.values(weekEvents).some((event) => {
    if (ignoreEventId && event.id === ignoreEventId) return false;
    if (event.date !== input.date) return false;

    const existingStart = getTotalMinutes(event.startHour, event.startMinute);
    const existingEnd = getTotalMinutes(event.endHour, event.endMinute);

    return startTotal < existingEnd && endTotal > existingStart;
  });
}

export async function createEvent(input: EventInput) {
  if (!input.title.trim()) return false;
  if (!isValidEventTime(input)) return false;

  const hasOverlap = await hasEventOverlap(input);

  if (hasOverlap) {
    console.log("이미 같은 시간대에 일정이 있습니다.");
    return false;
  }

  const allEvents = await loadEvents();

  const id = Date.now().toString();
  const weekKey = getWeekKey(input.date);

  const newEvent: EventItem = {
    id,
    title: input.title.trim(),
    date: input.date,
    startHour: input.startHour,
    startMinute: input.startMinute,
    endHour: input.endHour,
    endMinute: input.endMinute,
    labelId: input.labelId,
  };

  if (!allEvents[weekKey]) {
    allEvents[weekKey] = {};
  }

  allEvents[weekKey][id] = newEvent;

  await saveEvents(allEvents);

  return true;
}

export async function updateEvent(
  eventId: string,
  originalWeekKey: string,
  input: EventInput,
) {
  if (!input.title.trim()) return false;
  if (!isValidEventTime(input)) return false;

  const hasOverlap = await hasEventOverlap(input, eventId);

  if (hasOverlap) {
    console.log("이미 같은 시간대에 일정이 있습니다.");
    return false;
  }

  const allEvents = await loadEvents();
  const originalEvent = allEvents[originalWeekKey]?.[eventId];

  if (!originalEvent) return false;

  const nextWeekKey = getWeekKey(input.date);

  const nextEvent: EventItem = {
    ...originalEvent,
    title: input.title.trim(),
    date: input.date,
    startHour: input.startHour,
    startMinute: input.startMinute,
    endHour: input.endHour,
    endMinute: input.endMinute,
    labelId: input.labelId,
  };

  if (allEvents[originalWeekKey]) {
    delete allEvents[originalWeekKey][eventId];
  }

  if (!allEvents[nextWeekKey]) {
    allEvents[nextWeekKey] = {};
  }

  allEvents[nextWeekKey][eventId] = nextEvent;

  await saveEvents(allEvents);

  return true;
}

export async function deleteEvent(eventId: string, originalWeekKey: string) {
  const allEvents = await loadEvents();

  if (allEvents[originalWeekKey]) {
    delete allEvents[originalWeekKey][eventId];
  }

  await saveEvents(allEvents);

  return true;
}

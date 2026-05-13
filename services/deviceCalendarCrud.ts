import * as Calendar from "expo-calendar";

import type { EventFormInput } from "@/utils/events";
import { toUtcMs } from "@/utils/datetime";

function eventPayloadFromInput(input: EventFormInput) {
  const startDate = new Date(
    toUtcMs(input.date, input.startHour, input.startMinute),
  );
  const endDate = new Date(toUtcMs(input.date, input.endHour, input.endMinute));

  if (!input.title.trim() || endDate <= startDate) return null;

  return {
    title: input.title.trim(),
    startDate,
    endDate,
    allDay: false,
    notes: "",
  };
}

export async function createDeviceCalendarEvent(
  calendarId: string,
  input: EventFormInput,
): Promise<boolean> {
  const payload = eventPayloadFromInput(input);
  if (!payload) return false;

  await Calendar.createEventAsync(calendarId, payload);
  return true;
}

export async function updateDeviceCalendarEvent(
  eventId: string,
  input: EventFormInput,
): Promise<boolean> {
  const payload = eventPayloadFromInput(input);
  if (!payload) return false;

  await Calendar.updateEventAsync(eventId, payload);
  return true;
}

export async function deleteDeviceCalendarEvent(eventId: string): Promise<void> {
  await Calendar.deleteEventAsync(eventId);
}

export async function getDeviceCalendarEvent(eventId: string) {
  return Calendar.getEventAsync(eventId);
}

import type { EventFormInput } from "@/utils/events";

export async function createDeviceCalendarEvent(
  _calendarId: string,
  _input: EventFormInput,
): Promise<boolean> {
  return false;
}

export async function updateDeviceCalendarEvent(
  _eventId: string,
  _input: EventFormInput,
): Promise<boolean> {
  return false;
}

export async function deleteDeviceCalendarEvent(_eventId: string): Promise<void> {}

export async function getDeviceCalendarEvent(_eventId: string) {
  return null;
}

import * as Calendar from 'expo-calendar';
import type { Event, Label } from '../database/schema';
import { expandEventOccurrences } from './recurrence';
import {
  buildDeviceCalendarOptions,
  isDeviceCalendarLabEnabled,
  type DeviceCalendarOption,
} from './deviceCalendarSettings';
import { getGoogleConnectionStatus } from './googleCalendarApi';

// Unified type for rendering — local DB events and read-only device calendar events.
export type MergedEvent = {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  isAllDay: boolean;
  source: 'local' | 'device';
  labelColor: string;
  originalEventId?: string;
  isReadonly?: boolean;
  syncStatus?: string;
  deviceCalendarId?: string;
  deviceCalendarTitle?: string;
  canModify?: boolean;
};

export type EventWithLabel = Event & { label: Label | null };

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

async function hasCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status === 'granted';
}

async function getGoogleStatusForDeviceFiltering() {
  try {
    return await getGoogleConnectionStatus();
  } catch {
    return null;
  }
}

export async function getDeviceCalendarOptions(): Promise<DeviceCalendarOption[]> {
  if (!(await isDeviceCalendarLabEnabled())) return [];

  const hasPermission = await hasCalendarPermission();
  if (!hasPermission) return [];

  const [calendars, googleStatus] = await Promise.all([
    Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT),
    getGoogleStatusForDeviceFiltering(),
  ]);

  return buildDeviceCalendarOptions(calendars, googleStatus);
}

export async function getWritableDeviceCalendarOptions(): Promise<DeviceCalendarOption[]> {
  const options = await getDeviceCalendarOptions();
  return options.filter(
    (calendar) =>
      calendar.selected &&
      calendar.allowsModifications &&
      calendar.disabledReason === null,
  );
}

// Flow C — fetch device calendar events and merge with local DB events in memory.
// Device events are NEVER written to the local DB.
export async function getMergedEvents(
  localEvents: EventWithLabel[],
  startDate: Date,
  endDate: Date,
): Promise<MergedEvent[]> {
  const localMapped: MergedEvent[] = localEvents
    .filter((e) => e.syncStatus !== 'pending_delete')
    .flatMap((e) =>
      expandEventOccurrences(e, startDate, endDate).map((occurrence) => ({
        id: occurrence.id,
        title: occurrence.title,
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        isAllDay: occurrence.isAllDay,
        source: 'local',
        labelColor: occurrence.label?.color ?? '#DC143C',
        originalEventId: occurrence.originalEventId,
        isReadonly: occurrence.label?.googleIsReadonly ?? false,
        syncStatus: occurrence.syncStatus,
      })),
    );

  let deviceMapped: MergedEvent[] = [];

  try {
    const calendars = await getDeviceCalendarOptions();
    const selectedCalendars = calendars.filter((calendar) => calendar.selected);
    const calendarsById = new Map(
      selectedCalendars.map((calendar) => [calendar.id, calendar]),
    );
    const calendarIds = selectedCalendars.map((c) => c.id);

    if (calendarIds.length > 0) {
      const deviceEvents = await Calendar.getEventsAsync(
        calendarIds,
        startDate,
        endDate,
      );
      deviceMapped = deviceEvents.map((e) => {
        const startTime = new Date(e.startDate).getTime();
        const endTime = new Date(e.endDate).getTime();

        return {
          id: `device__${e.calendarId}__${e.id}__${startTime}`,
          title: e.title ?? '',
          startTime,
          endTime,
          isAllDay: e.allDay ?? false,
          source: 'device',
          labelColor: calendarsById.get(e.calendarId)?.color ?? '#A8C8F0',
          originalEventId: e.id,
          isReadonly: !calendarsById.get(e.calendarId)?.allowsModifications,
          deviceCalendarId: e.calendarId,
          deviceCalendarTitle: calendarsById.get(e.calendarId)?.title,
          canModify: Boolean(calendarsById.get(e.calendarId)?.allowsModifications),
        };
      });
    }
  } catch {
    // Device calendar unavailable — show only local events
  }

  return [...localMapped, ...deviceMapped].sort((a, b) => a.startTime - b.startTime);
}

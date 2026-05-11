import * as Calendar from 'expo-calendar';
import type { Event, Label } from '../database/schema';
import { expandEventOccurrences } from './recurrence';

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
};

export type EventWithLabel = Event & { label: Label | null };

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
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
        labelColor: occurrence.label?.color ?? '#9FF4E2',
        originalEventId: occurrence.originalEventId,
        isReadonly: occurrence.label?.googleIsReadonly ?? false,
        syncStatus: occurrence.syncStatus,
      })),
    );

  let deviceMapped: MergedEvent[] = [];

  try {
    const hasPermission = await requestCalendarPermission();
    if (hasPermission) {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const calendarIds = calendars.map((c) => c.id);
      if (calendarIds.length > 0) {
        const deviceEvents = await Calendar.getEventsAsync(
          calendarIds,
          startDate,
          endDate,
        );
        deviceMapped = deviceEvents.map((e) => ({
          id: `device__${e.id}`,
          title: e.title ?? '',
          startTime: new Date(e.startDate).getTime(),
          endTime: new Date(e.endDate).getTime(),
          isAllDay: e.allDay ?? false,
          source: 'device',
          labelColor: '#A8C8F0',
        }));
      }
    }
  } catch {
    // Device calendar unavailable — show only local events
  }

  return [...localMapped, ...deviceMapped].sort((a, b) => a.startTime - b.startTime);
}

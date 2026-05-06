// expo-calendar is not supported on web.
import type { EventWithLabel } from './deviceSync';

export type { MergedEvent, EventWithLabel } from './deviceSync';

export async function requestCalendarPermission(): Promise<boolean> {
  return false;
}

export async function getMergedEvents(
  localEvents: EventWithLabel[],
  _startDate: Date,
  _endDate: Date,
) {
  return localEvents
    .filter((e) => e.syncStatus !== 'pending_delete')
    .map((e) => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      isAllDay: e.isAllDay,
      source: 'local' as const,
      labelColor: e.label?.color ?? '#4A90E2',
      syncStatus: e.syncStatus,
    }));
}

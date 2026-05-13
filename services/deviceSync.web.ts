// expo-calendar is not supported on web.
import type { EventWithLabel } from './deviceSync';
import type { DeviceCalendarOption } from './deviceCalendarSettings';

export type { MergedEvent, EventWithLabel } from './deviceSync';

export async function requestCalendarPermission(): Promise<boolean> {
  return false;
}

export async function isDeviceCalendarLabEnabled(): Promise<boolean> {
  return false;
}

export async function getDeviceCalendarOptions(): Promise<DeviceCalendarOption[]> {
  return [];
}

export async function getWritableDeviceCalendarOptions(): Promise<DeviceCalendarOption[]> {
  return [];
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
      labelColor: e.label?.color ?? '#9FF4E2',
      isReadonly: e.label?.googleIsReadonly ?? false,
      syncStatus: e.syncStatus,
    }));
}

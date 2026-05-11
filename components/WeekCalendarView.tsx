import React, { useMemo, useRef } from "react";
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { DAYS, formatDate, getWeekDates } from "@/utils/date";

dayjs.extend(utc);

const START_HOUR = 0;
const END_HOUR = 24;
const VISIBLE_HOURS = END_HOUR - START_HOUR;
const HOUR_HEIGHT = 72;
const TIME_COLUMN_WIDTH = 44;
const HORIZONTAL_PADDING = 24;
const EVENT_GAP = 2;
const ALL_DAY_EVENT_HEIGHT = 22;
const ALL_DAY_EVENT_GAP = 3;
const ALL_DAY_ROW_PADDING_VERTICAL = 4;
const MAX_VISIBLE_ALL_DAY_EVENTS = 3;
const DEFAULT_LAYOUT_GROUP_ID = "default";

export type WeekCalendarEvent = {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  isAllDay?: boolean;
  color: string;
  opacity?: number;
  source?: string;
  editable?: boolean;
  editEventId?: string;
  layoutGroupId?: string;
};

type Props = {
  weekKey: string;
  events: WeekCalendarEvent[];
  emptyText?: string;
  onEventPress?: (event: WeekCalendarEvent) => void;
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
};

type PositionedEvent = WeekCalendarEvent & {
  eventDateIndex: number;
  laneIndex: number;
  laneCount: number;
  startHour: number;
  endHour: number;
};

type LanePosition = {
  event: WeekCalendarEvent;
  laneIndex: number;
  laneCount: number;
};

function isUtcMidnight(timestamp: number): boolean {
  const date = new Date(timestamp);
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

function getAllDayDateRange(event: WeekCalendarEvent) {
  if (isUtcMidnight(event.startTime) && isUtcMidnight(event.endTime)) {
    const startDate = dayjs.utc(event.startTime).format("YYYY-MM-DD");
    return {
      startDate,
      endDate:
        event.endTime > event.startTime
          ? dayjs.utc(event.endTime).subtract(1, "day").format("YYYY-MM-DD")
          : startDate,
    };
  }

  return {
    startDate: dayjs(event.startTime).format("YYYY-MM-DD"),
    endDate:
      event.endTime > event.startTime
        ? dayjs(event.endTime - 1).format("YYYY-MM-DD")
        : dayjs(event.startTime).format("YYYY-MM-DD"),
  };
}

function positionCluster(cluster: WeekCalendarEvent[]): LanePosition[] {
  const laneEnds: number[] = [];
  const assigned = cluster.map((event) => {
    let laneIndex = laneEnds.findIndex((endTime) => endTime <= event.startTime);
    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(event.endTime);
    } else {
      laneEnds[laneIndex] = event.endTime;
    }

    return { event, laneIndex };
  });

  const laneCount = Math.max(laneEnds.length, 1);
  return assigned.map((item) => ({ ...item, laneCount }));
}

function positionEventsInGroup(
  groupEvents: WeekCalendarEvent[],
): LanePosition[] {
  const sorted = [...groupEvents].sort(
    (a, b) => a.startTime - b.startTime || a.endTime - b.endTime,
  );
  const positioned: LanePosition[] = [];

  let cluster: WeekCalendarEvent[] = [];
  let clusterEnd = 0;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    positioned.push(...positionCluster(cluster));
    cluster = [];
    clusterEnd = 0;
  };

  for (const event of sorted) {
    if (cluster.length === 0) {
      cluster = [event];
      clusterEnd = event.endTime;
      continue;
    }

    const touchesCluster = event.startTime < clusterEnd;
    if (!touchesCluster) {
      flushCluster();
      cluster = [event];
      clusterEnd = event.endTime;
      continue;
    }

    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, event.endTime);
  }

  flushCluster();
  return positioned;
}

export default function WeekCalendarView({
  weekKey,
  events,
  emptyText,
  onEventPress,
  onPreviousWeek,
  onNextWeek,
}: Props) {
  const { width } = useWindowDimensions();
  const weekDates = useMemo(() => getWeekDates(weekKey), [weekKey]);
  const previousWeekRef = useRef(onPreviousWeek);
  const nextWeekRef = useRef(onNextWeek);
  previousWeekRef.current = onPreviousWeek;
  nextWeekRef.current = onNextWeek;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const absDx = Math.abs(gestureState.dx);
        const absDy = Math.abs(gestureState.dy);

        return absDx > 24 && absDx > absDy * 1.25;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) < 60) return;

        if (gestureState.dx > 0) {
          previousWeekRef.current?.();
        } else {
          nextWeekRef.current?.();
        }
      },
    }),
  ).current;
  const dayWidth =
    (width - TIME_COLUMN_WIDTH - HORIZONTAL_PADDING * 2) / 7;
  const allDayEventsByDay = useMemo(() => {
    const buckets = Array.from(
      { length: 7 },
      () => [] as WeekCalendarEvent[],
    );

    for (const event of events) {
      if (!event.isAllDay) continue;

      const { startDate, endDate } = getAllDayDateRange(event);

      weekDates.forEach((date, index) => {
        const dayDate = formatDate(date);
        if (dayDate >= startDate && dayDate <= endDate) {
          buckets[index].push(event);
        }
      });
    }

    return buckets.map((bucket) =>
      bucket.sort((a, b) => a.startTime - b.startTime || a.title.localeCompare(b.title)),
    );
  }, [events, weekDates]);
  const hasAllDayEvents = allDayEventsByDay.some((dayEvents) => dayEvents.length > 0);
  const allDayRowHeight = hasAllDayEvents
    ? ALL_DAY_ROW_PADDING_VERTICAL * 2 +
      Math.max(
        ...allDayEventsByDay.map((dayEvents) =>
          Math.min(dayEvents.length, MAX_VISIBLE_ALL_DAY_EVENTS),
        ),
      ) *
        ALL_DAY_EVENT_HEIGHT +
      (Math.max(
        ...allDayEventsByDay.map((dayEvents) =>
          Math.min(dayEvents.length, MAX_VISIBLE_ALL_DAY_EVENTS),
        ),
      ) -
        1) *
        ALL_DAY_EVENT_GAP
    : 0;
  const positionedEvents = useMemo<PositionedEvent[]>(() => {
    const groups = new Map<string, WeekCalendarEvent[]>();

    for (const event of events) {
      if (event.isAllDay) continue;

      const startD = dayjs(event.startTime);
      const eventDate = startD.format("YYYY-MM-DD");
      const eventDateIndex = weekDates.findIndex(
        (d) => formatDate(d) === eventDate,
      );
      if (eventDateIndex === -1) continue;

      const groupId = event.layoutGroupId ?? DEFAULT_LAYOUT_GROUP_ID;
      const key = `${eventDate}:${groupId}`;
      const group = groups.get(key) ?? [];
      group.push(event);
      groups.set(key, group);
    }

    return Array.from(groups.values()).flatMap((groupEvents) =>
      positionEventsInGroup(groupEvents).map(({ event, laneIndex, laneCount }) => {
        const startD = dayjs(event.startTime);
        const endD = dayjs(event.endTime);
        const eventDate = startD.format("YYYY-MM-DD");
        const eventDateIndex = weekDates.findIndex(
          (d) => formatDate(d) === eventDate,
        );

        return {
          ...event,
          eventDateIndex,
          laneIndex,
          laneCount,
          startHour: startD.hour() + startD.minute() / 60,
          endHour: endD.hour() + endD.minute() / 60,
        };
      }),
    );
  }, [events, weekDates]);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.headerRow}>
        <View style={{ width: TIME_COLUMN_WIDTH }} />
        {DAYS.map((day, i) => (
          <View key={day} style={[styles.dayHeader, { width: dayWidth }]}>
            <Text style={styles.dayText}>{day}</Text>
            <Text style={styles.dateText}>{weekDates[i].getDate()}</Text>
          </View>
        ))}
      </View>

      {hasAllDayEvents && (
        <View style={[styles.allDayRow, { minHeight: allDayRowHeight }]}>
          <View style={{ width: TIME_COLUMN_WIDTH }} />
          {weekDates.map((date, index) => {
            const dayEvents = allDayEventsByDay[index];
            const visibleCount =
              dayEvents.length > MAX_VISIBLE_ALL_DAY_EVENTS
                ? MAX_VISIBLE_ALL_DAY_EVENTS - 1
                : dayEvents.length;
            const visibleEvents = dayEvents.slice(0, visibleCount);
            const hiddenCount = dayEvents.length - visibleCount;

            return (
              <View
                key={formatDate(date)}
                style={[styles.allDayCell, { width: dayWidth }]}
              >
                {visibleEvents.map((event) => (
                  <Pressable
                    key={`${formatDate(date)}:${event.id}`}
                    disabled={!onEventPress}
                    onPress={() => onEventPress?.(event)}
                    style={[
                      styles.allDayPill,
                      {
                        backgroundColor: event.color,
                        opacity: event.opacity ?? 1,
                      },
                    ]}
                  >
                    <Text style={styles.allDayText} numberOfLines={1}>
                      {event.title}
                    </Text>
                  </Pressable>
                ))}
                {hiddenCount > 0 && (
                  <View style={styles.allDayMorePill}>
                    <Text style={styles.allDayMoreText}>+{hiddenCount}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <ScrollView>
        <View style={styles.grid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View
              key={`column-${i}`}
              style={[
                styles.dayLine,
                { left: TIME_COLUMN_WIDTH + i * dayWidth },
              ]}
            />
          ))}

          {Array.from({ length: VISIBLE_HOURS + 1 }).map((_, i) => (
            <React.Fragment key={i}>
              <View style={[styles.hourLine, { top: i * HOUR_HEIGHT }]} />
              {i < VISIBLE_HOURS && (
                <Text style={[styles.hourText, { top: i * HOUR_HEIGHT + 4 }]}>
                  {formatHourLabel(START_HOUR + i)}
                </Text>
              )}
            </React.Fragment>
          ))}

          {emptyText && events.length === 0 && (
            <View style={styles.emptyBox} pointerEvents="none">
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          )}

          {positionedEvents.map((event) => {
            const laneWidth = dayWidth / event.laneCount;
            const laneGap = event.laneCount > 1 ? EVENT_GAP : 0;
            const visibleStartHour = Math.max(event.startHour, START_HOUR);
            const visibleEndHour = Math.min(event.endHour, END_HOUR);
            const isVisible = visibleEndHour > visibleStartHour;

            if (!isVisible) return null;

            return (
              <Pressable
                key={event.id}
                disabled={!onEventPress}
                onPress={() => onEventPress?.(event)}
                style={[
                  styles.eventBlock,
                  {
                    backgroundColor: getEventFill(event.color),
                    top: (visibleStartHour - START_HOUR) * HOUR_HEIGHT + 8,
                    height: Math.max(
                      (visibleEndHour - visibleStartHour) * HOUR_HEIGHT - 16,
                      50,
                    ),
                    left:
                      TIME_COLUMN_WIDTH +
                      event.eventDateIndex * dayWidth +
                      event.laneIndex * laneWidth +
                      laneGap / 2 +
                      1,
                    width: Math.max(laneWidth - laneGap - 2, 8),
                    opacity: event.opacity ?? 1,
                  },
                ]}
              >
                <Text style={styles.eventTitle} numberOfLines={2}>
                  {event.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function formatHourLabel(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function getEventFill(color: string) {
  return color || "#9FF4E2";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#EDEDED",
  },
  dayHeader: {
    height: 42,
    justifyContent: "center",
    borderLeftWidth: 1,
    borderLeftColor: "#F2F2F2",
    paddingLeft: 4,
  },
  dayText: {
    color: "#5D6470",
    fontSize: 7,
    fontWeight: "800",
  },
  dateText: {
    color: "#05070A",
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 20,
  },
  allDayRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E6E6E6",
    paddingVertical: ALL_DAY_ROW_PADDING_VERTICAL,
  },
  allDayCell: {
    gap: ALL_DAY_EVENT_GAP,
    paddingHorizontal: 2,
  },
  allDayPill: {
    height: ALL_DAY_EVENT_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  allDayText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  allDayMorePill: {
    height: ALL_DAY_EVENT_HEIGHT,
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: "#F1F1F1",
    paddingHorizontal: 4,
  },
  allDayMoreText: {
    color: "#555",
    fontSize: 10,
    fontWeight: "700",
  },
  grid: {
    height: VISIBLE_HOURS * HOUR_HEIGHT,
    position: "relative",
  },
  hourLine: {
    position: "absolute",
    left: TIME_COLUMN_WIDTH,
    right: 0,
    height: 1,
    backgroundColor: "#F1F1F1",
  },
  dayLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#F3F3F3",
  },
  hourText: {
    position: "absolute",
    left: 0,
    width: TIME_COLUMN_WIDTH,
    textAlign: "left",
    fontSize: 9,
    color: "#5E6571",
  },
  eventBlock: {
    position: "absolute",
    overflow: "hidden",
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },
  eventTitle: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 13,
  },
  emptyBox: {
    position: "absolute",
    top: 140,
    left: TIME_COLUMN_WIDTH,
    right: 12,
    alignItems: "center",
    padding: 16,
  },
  emptyText: {
    color: "#777",
    fontSize: 14,
    textAlign: "center",
  },
});

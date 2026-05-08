import React, { useMemo } from "react";

import SharedBundleViewer, {
  type SharedBundleSource,
} from "@/components/SharedBundleViewer";
import type { WeekCalendarEvent } from "@/components/WeekCalendarView";
import { formatDate, getCurrentWeekKey, getWeekDates } from "@/utils/date";
import { toUtcMs } from "@/utils/datetime";

type WebSharedBundle = SharedBundleSource & {
  events: {
    title: string;
    dayIndex: number;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
  }[];
};

const WEB_SHARED_BUNDLES: WebSharedBundle[] = [
  {
    id: "web_exam_week",
    title: "시험 주간 일정",
    subtitle: "민서",
    color: "#6C8AE4",
    events: [
      { title: "자료조사", dayIndex: 1, startHour: 9, startMinute: 0, endHour: 10, endMinute: 30 },
      { title: "팀플 회의", dayIndex: 3, startHour: 13, startMinute: 0, endHour: 15, endMinute: 0 },
      { title: "실험 보고서", dayIndex: 5, startHour: 10, startMinute: 0, endHour: 12, endMinute: 0 },
    ],
  },
  {
    id: "web_club",
    title: "동아리 일정",
    subtitle: "지훈",
    color: "#E27A5F",
    events: [
      { title: "운영 회의", dayIndex: 2, startHour: 14, startMinute: 0, endHour: 16, endMinute: 0 },
      { title: "공연 연습", dayIndex: 4, startHour: 18, startMinute: 0, endHour: 20, endMinute: 0 },
      { title: "봉사 활동", dayIndex: 6, startHour: 11, startMinute: 0, endHour: 13, endMinute: 0 },
    ],
  },
  {
    id: "web_available",
    title: "가능 시간 모음",
    subtitle: "서연",
    color: "#3BAF7A",
    events: [
      { title: "카페 알바", dayIndex: 1, startHour: 15, startMinute: 0, endHour: 18, endMinute: 0 },
      { title: "병원 예약", dayIndex: 3, startHour: 9, startMinute: 0, endHour: 11, endMinute: 0 },
      { title: "스터디", dayIndex: 4, startHour: 10, startMinute: 0, endHour: 12, endMinute: 0 },
      { title: "알바", dayIndex: 5, startHour: 14, startMinute: 0, endHour: 17, endMinute: 0 },
    ],
  },
];

export default function WebSharedScreen() {
  const weekKey = getCurrentWeekKey();
  const weekDates = useMemo(() => getWeekDates(weekKey), [weekKey]);

  const sources = useMemo<SharedBundleSource[]>(
    () =>
      WEB_SHARED_BUNDLES.map(({ id, title, subtitle, color }) => ({
        id,
        title,
        subtitle,
        color,
      })),
    [],
  );

  const events = useMemo<WeekCalendarEvent[]>(
    () =>
      WEB_SHARED_BUNDLES.flatMap((bundle) =>
        bundle.events.map((event, index) => {
          const date = formatDate(weekDates[event.dayIndex]);

          return {
            id: `${bundle.id}:${index}`,
            title: event.title,
            startTime: toUtcMs(date, event.startHour, event.startMinute),
            endTime: toUtcMs(date, event.endHour, event.endMinute),
            color: bundle.color,
            source: bundle.id,
            editable: false,
            layoutGroupId: bundle.id,
          };
        }),
      ),
    [weekDates],
  );

  return (
    <SharedBundleViewer
      weekKey={weekKey}
      sources={sources}
      events={events}
      emptyText="공유된 일정이 없습니다."
      defaultSelectedSourceIds={sources.map((source) => source.id)}
    />
  );
}

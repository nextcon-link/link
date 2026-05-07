import { and, eq } from "drizzle-orm";

import { db } from "@/database";
import { sharedBundleEvents, sharedBundles } from "@/database/schema";
import { formatDate, getCurrentWeekKey, getWeekDates } from "@/utils/date";
import { toUtcMs } from "@/utils/datetime";

type DemoBundle = {
  id: string;
  title: string;
  ownerName: string;
  color: string;
  events: Array<{
    title: string;
    dayIndex: number;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
  }>;
};

const DEMO_BUNDLES: DemoBundle[] = [
  {
    id: "minseo",
    title: "시험 주간 일정",
    ownerName: "민서",
    color: "#6C8AE4",
    events: [
      { title: "자료조사", dayIndex: 1, startHour: 9, startMinute: 0, endHour: 10, endMinute: 30 },
      { title: "팀플 회의", dayIndex: 3, startHour: 13, startMinute: 0, endHour: 15, endMinute: 0 },
      { title: "실험 보고서", dayIndex: 5, startHour: 10, startMinute: 0, endHour: 12, endMinute: 0 },
    ],
  },
  {
    id: "jihun",
    title: "동아리 일정",
    ownerName: "지훈",
    color: "#E27A5F",
    events: [
      { title: "운영 회의", dayIndex: 2, startHour: 14, startMinute: 0, endHour: 16, endMinute: 0 },
      { title: "공연 연습", dayIndex: 4, startHour: 18, startMinute: 0, endHour: 20, endMinute: 0 },
      { title: "봉사 활동", dayIndex: 6, startHour: 11, startMinute: 0, endHour: 13, endMinute: 0 },
    ],
  },
  {
    id: "seoyeon",
    title: "가능 시간 모음",
    ownerName: "서연",
    color: "#3BAF7A",
    events: [
      { title: "카페 알바", dayIndex: 1, startHour: 15, startMinute: 0, endHour: 18, endMinute: 0 },
      { title: "병원 예약", dayIndex: 3, startHour: 9, startMinute: 0, endHour: 11, endMinute: 0 },
      { title: "스터디", dayIndex: 4, startHour: 10, startMinute: 0, endHour: 12, endMinute: 0 },
      { title: "알바", dayIndex: 5, startHour: 14, startMinute: 0, endHour: 17, endMinute: 0 },
    ],
  },
];

export async function seedDemoSharedBundles(userId: string): Promise<void> {
  if (!__DEV__ || !userId) return;

  const existing = await db
    .select()
    .from(sharedBundles)
    .where(and(eq(sharedBundles.userId, userId), eq(sharedBundles.isDemo, true)));

  if (existing.length >= DEMO_BUNDLES.length) return;

  await db
    .delete(sharedBundles)
    .where(and(eq(sharedBundles.userId, userId), eq(sharedBundles.isDemo, true)));

  const now = Date.now();
  const weekDates = getWeekDates(getCurrentWeekKey());

  for (const bundle of DEMO_BUNDLES) {
    const bundleId = `demo_${userId}_${bundle.id}`;

    await db.insert(sharedBundles).values({
      id: bundleId,
      userId,
      title: bundle.title,
      ownerName: bundle.ownerName,
      color: bundle.color,
      expiresAt: null,
      isDemo: true,
      createdAt: now,
    });

    for (const [index, event] of bundle.events.entries()) {
      const date = formatDate(weekDates[event.dayIndex]);

      await db.insert(sharedBundleEvents).values({
        id: `${bundleId}_event_${index}`,
        bundleId,
        userId,
        title: event.title,
        startTime: toUtcMs(date, event.startHour, event.startMinute),
        endTime: toUtcMs(date, event.endHour, event.endMinute),
        isAllDay: false,
        createdAt: now,
      });
    }
  }
}

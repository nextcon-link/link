import { eq } from "drizzle-orm";

import { db } from "@/database";
import { sharedBundleEvents, sharedBundles } from "@/database/schema";
import { formatDate, getWeekDates } from "@/utils/date";
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

const DEMO_USER_ID = "__demo__";
const DEMO_WEEK_KEY = "2026-05-10";

const DEMO_BUNDLES: DemoBundle[] = [
  {
    id: "minseo",
    title: "시험 주간 일정",
    ownerName: "민서",
    color: "#6C8AE4",
    events: [
      { title: "자료조사", dayIndex: 1, startHour: 9, startMinute: 0, endHour: 10, endMinute: 30 },
      { title: "팀 회의", dayIndex: 3, startHour: 13, startMinute: 0, endHour: 15, endMinute: 0 },
      { title: "시험 보고서", dayIndex: 5, startHour: 10, startMinute: 0, endHour: 12, endMinute: 0 },
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

function getDemoBundleId(bundleId: string) {
  return `demo_${bundleId}`;
}

export async function seedDemoSharedBundles(): Promise<void> {
  if (!__DEV__) return;

  const expectedIds = new Set(DEMO_BUNDLES.map((bundle) => getDemoBundleId(bundle.id)));
  const existingDemos = await db
    .select({ id: sharedBundles.id })
    .from(sharedBundles)
    .where(eq(sharedBundles.isDemo, true));
  const existingIds = new Set(existingDemos.map((bundle) => bundle.id));
  const hasOnlyCommonDemos =
    existingIds.size === expectedIds.size &&
    [...expectedIds].every((id) => existingIds.has(id));

  if (hasOnlyCommonDemos) return;

  await db.delete(sharedBundles).where(eq(sharedBundles.isDemo, true));

  const now = Date.now();
  const weekDates = getWeekDates(DEMO_WEEK_KEY);

  for (const bundle of DEMO_BUNDLES) {
    const bundleId = getDemoBundleId(bundle.id);

    await db.insert(sharedBundles).values({
      id: bundleId,
      userId: DEMO_USER_ID,
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
        userId: DEMO_USER_ID,
        title: event.title,
        startTime: toUtcMs(date, event.startHour, event.startMinute),
        endTime: toUtcMs(date, event.endHour, event.endMinute),
        isAllDay: false,
        createdAt: now,
      });
    }
  }
}

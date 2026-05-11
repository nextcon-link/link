import React, { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { and, eq, gte, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import dayjs from "dayjs";

import SharedBundleViewer, {
  type GeneratedShareQr,
  type ShareLabelOption,
  type ShareQrSettings,
  type ShareVisibilityOverride,
  type SharedBundleSource,
} from "@/components/SharedBundleViewer";
import type { WeekCalendarEvent } from "@/components/WeekCalendarView";
import { db } from "@/database";
import {
  events,
  labels,
  sharedBundleEvents,
  sharedBundles,
} from "@/database/schema";
import { seedDemoSharedBundles } from "@/services/sharedDemoSeed";
import {
  cleanupExpiredSharedBundles,
  createSharedBundleLink,
  deleteSharedBundle,
  updateSharedBundleColor,
} from "@/services/sharedBundleService";
import { expandEventOccurrences } from "@/services/recurrence";
import { allowCalendarEntry } from "@/store/calendarAccess";
import { useAuthStore } from "@/store/auth";
import {
  addWeeks,
  formatDate,
  getCurrentWeekKey,
  getWeekDates,
  getWeekKey,
} from "@/utils/date";
import { sharingMode } from "@/utils/events";

const MY_CALENDAR_ID = "mine";
const MY_CALENDAR_COLOR = "#9FF4E2";
const BLIND_TITLE = "블라인드";
type ShareVisibility = ShareVisibilityOverride;

type LocalEventRow = {
  event: typeof events.$inferSelect;
  label: typeof labels.$inferSelect | null;
};

type ShareRange = {
  start: number;
  end: number;
  startDate: string;
  endDate: string;
  error: string | null;
};

const DEFAULT_SHARE_SETTINGS: ShareQrSettings = {
  bundleTitle: "",
  selectedLabelIds: [],
  includeUnlabeled: true,
  eventVisibilityOverrides: {},
  rangePreset: "this_week",
  customStartDate: "",
  customEndDate: "",
  expiryPreset: "none",
  customExpiryDays: "",
};

function getOwnerName(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataName =
    user.user_metadata?.display_name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.username;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return user.email?.split("@")[0] || "공유 사용자";
}

function isValidDateString(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    dayjs(value).format("YYYY-MM-DD") === value
  );
}

function getShareRange(settings: ShareQrSettings, weekKey: string): ShareRange {
  const weekDates = getWeekDates(weekKey);
  const startDate = formatDate(weekDates[0]);

  if (settings.rangePreset === "this_week") {
    const endDate = formatDate(weekDates[6]);
    return {
      start: dayjs(startDate).startOf("day").valueOf(),
      end: dayjs(endDate).endOf("day").valueOf(),
      startDate,
      endDate,
      error: null,
    };
  }

  if (settings.rangePreset === "two_weeks") {
    const end = dayjs(startDate).add(13, "day");
    const endDate = end.format("YYYY-MM-DD");
    return {
      start: dayjs(startDate).startOf("day").valueOf(),
      end: end.endOf("day").valueOf(),
      startDate,
      endDate,
      error: null,
    };
  }

  const customStartDate = settings.customStartDate.trim();
  const customEndDate = settings.customEndDate.trim();

  if (!isValidDateString(customStartDate) || !isValidDateString(customEndDate)) {
    return {
      start: dayjs(startDate).startOf("day").valueOf(),
      end: dayjs(startDate).endOf("day").valueOf(),
      startDate: customStartDate || "YYYY-MM-DD",
      endDate: customEndDate || "YYYY-MM-DD",
      error: "기타 기간은 YYYY-MM-DD 형식으로 입력하세요.",
    };
  }

  const start = dayjs(customStartDate).startOf("day");
  const end = dayjs(customEndDate).endOf("day");
  if (end.valueOf() < start.valueOf()) {
    return {
      start: start.valueOf(),
      end: end.valueOf(),
      startDate: customStartDate,
      endDate: customEndDate,
      error: "종료일은 시작일보다 빠를 수 없습니다.",
    };
  }

  return {
    start: start.valueOf(),
    end: end.valueOf(),
    startDate: customStartDate,
    endDate: customEndDate,
    error: null,
  };
}

function getExpiryError(settings: ShareQrSettings) {
  if (settings.expiryPreset !== "custom") return null;

  const days = Number.parseInt(settings.customExpiryDays, 10);
  if (!Number.isFinite(days) || days <= 0) {
    return "기타 일수는 1 이상의 숫자로 입력하세요.";
  }

  return null;
}

function getExpiresAt(settings: ShareQrSettings, now: number) {
  if (settings.expiryPreset === "none") return null;

  const days =
    settings.expiryPreset === "custom"
      ? Number.parseInt(settings.customExpiryDays, 10)
      : Number.parseInt(settings.expiryPreset, 10);

  if (!Number.isFinite(days) || days <= 0) return null;
  return dayjs(now).add(days, "day").valueOf();
}

function formatRangeSummary(range: ShareRange) {
  return `${range.startDate} - ${range.endDate}`;
}

function formatExpirySummary(settings: ShareQrSettings) {
  if (settings.expiryPreset === "none") return "상대방 화면에서 사라지지 않음";

  const days =
    settings.expiryPreset === "custom"
      ? Number.parseInt(settings.customExpiryDays, 10)
      : Number.parseInt(settings.expiryPreset, 10);

  return Number.isFinite(days) && days > 0
    ? `QR 생성 후 ${days}일 뒤 상대방 화면에서 사라짐`
    : "상대방 화면에서 사라지는 기간을 입력하세요.";
}

function formatBundleSubtitle(ownerName: string, expiresAt: number | null) {
  if (!expiresAt) return ownerName;

  const date = dayjs(expiresAt);
  return `${ownerName} · ${date.month() + 1}/${date.date()} ${date.format(
    "HH:mm",
  )} 사라짐`;
}

function resolveShareVisibility(row: LocalEventRow): ShareVisibility {
  const eventMode = row.event.sharingMode as sharingMode;

  if (eventMode === "visible") return "visible";
  if (eventMode === "blind") return "blind";
  if (eventMode === "invisible") return "invisible";

  const labelMode = row.label?.sharingMode as sharingMode | undefined;

  if (!labelMode || labelMode === "none" || labelMode === "visible") {
    return "visible";
  }
  if (labelMode === "blind") return "blind";
  return "invisible";
}

function getPreviewTitle(row: LocalEventRow, visibility: ShareVisibility) {
  if (visibility === "visible") return row.event.title;
  if (visibility === "blind") return BLIND_TITLE;
  return "비공개";
}

function getShareOverrideKey(eventId: string, occurrenceStartTime: number) {
  return `${eventId}:${occurrenceStartTime}`;
}

function getNextVisibility(visibility: ShareVisibility): ShareVisibility {
  if (visibility === "visible") return "blind";
  if (visibility === "blind") return "invisible";
  return "visible";
}

export default function SharedScreen() {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id ?? "";
  const { week } = useLocalSearchParams();
  const [weekKey, setWeekKey] = useState(getCurrentWeekKey());
  const [qr, setQr] = useState<GeneratedShareQr | null>(null);
  const [isCreatingQr, setIsCreatingQr] = useState(false);
  const [shareSettings, setShareSettings] = useState<ShareQrSettings>(
    DEFAULT_SHARE_SETTINGS,
  );
  const [didInitShareLabels, setDidInitShareLabels] = useState(false);
  const [sharePreviewWeekKey, setSharePreviewWeekKey] = useState(weekKey);
  const weekDates = useMemo(() => getWeekDates(weekKey), [weekKey]);
  const weekStart = dayjs(weekDates[0]).startOf("day").valueOf();
  const weekEnd = dayjs(weekDates[6]).endOf("day").valueOf();
  const shareRange = useMemo(
    () => getShareRange(shareSettings, weekKey),
    [shareSettings, weekKey],
  );
  const shareSettingsError =
    shareRange.error ??
    getExpiryError(shareSettings) ??
    (!shareSettings.bundleTitle.trim()
      ? "일정 덩어리 이름을 입력하세요."
      : null) ??
    (shareSettings.selectedLabelIds.length === 0 && !shareSettings.includeUnlabeled
      ? "공유할 라벨을 하나 이상 선택하세요."
      : null);

  useEffect(() => {
    seedDemoSharedBundles();
  }, []);

  useEffect(() => {
    if (typeof week === "string") {
      setWeekKey(week);
    }
  }, [week]);

  useEffect(() => {
    cleanupExpiredSharedBundles(userId);
  }, [userId]);

  useEffect(() => {
    if (shareRange.error) return;
    setSharePreviewWeekKey(getWeekKey(shareRange.startDate));
  }, [shareRange.error, shareRange.startDate]);

  useEffect(() => {
    if (!user || shareSettings.bundleTitle.trim()) return;

    setShareSettings((current) => ({
      ...current,
      bundleTitle: `${getOwnerName(user)}의 ${weekKey} 일정`,
    }));
  }, [shareSettings.bundleTitle, user, weekKey]);

  const { data: bundleList = [] } = useLiveQuery(
    db
      .select()
      .from(sharedBundles)
      .where(
        and(
          or(eq(sharedBundles.userId, userId), eq(sharedBundles.isDemo, true)),
          or(
            eq(sharedBundles.isDemo, true),
            isNull(sharedBundles.expiresAt),
            gte(sharedBundles.expiresAt, Date.now()),
          ),
        ),
      )
      .orderBy(sharedBundles.createdAt),
    [userId],
  );

  const { data: labelList = [] } = useLiveQuery(
    db
      .select()
      .from(labels)
      .where(
        and(
          eq(labels.userId, userId),
          ne(labels.syncStatus, "pending_delete"),
          isNull(labels.deletedAt),
        ),
      )
      .orderBy(labels.name),
    [userId],
  );

  useEffect(() => {
    if (didInitShareLabels || labelList.length === 0) return;

    setShareSettings((current) => ({
      ...current,
      selectedLabelIds: labelList
        .filter((label) => label.isVisible)
        .map((label) => label.id),
    }));
    setDidInitShareLabels(true);
  }, [didInitShareLabels, labelList]);

  const { data: localRows = [] } = useLiveQuery(
    db
      .select({
        event: events,
        label: labels,
      })
      .from(events)
      .leftJoin(
        labels,
        and(
          eq(events.labelId, labels.id),
          eq(labels.userId, userId),
          isNull(labels.deletedAt),
        ),
      )
      .where(
        and(
          eq(events.userId, userId),
          or(
            and(gte(events.startTime, weekStart), lte(events.startTime, weekEnd)),
            and(isNotNull(events.recurrenceRule), lte(events.startTime, weekEnd)),
          ),
          isNull(events.deletedAt),
          ne(events.syncStatus, "pending_delete"),
        ),
      ),
    [userId, weekStart, weekEnd],
  );

  const { data: shareRows = [] } = useLiveQuery(
    db
      .select({
        event: events,
        label: labels,
      })
      .from(events)
      .leftJoin(
        labels,
        and(
          eq(events.labelId, labels.id),
          eq(labels.userId, userId),
          isNull(labels.deletedAt),
        ),
      )
      .where(
        and(
          eq(events.userId, userId),
          or(
            and(lte(events.startTime, shareRange.end), gte(events.endTime, shareRange.start)),
            and(isNotNull(events.recurrenceRule), lte(events.startTime, shareRange.end)),
          ),
          isNull(events.deletedAt),
          ne(events.syncStatus, "pending_delete"),
        ),
      ),
    [userId, shareRange.start, shareRange.end],
  );

  const { data: sharedRows = [] } = useLiveQuery(
    db
      .select({
        bundle: sharedBundles,
        event: sharedBundleEvents,
      })
      .from(sharedBundleEvents)
      .innerJoin(
        sharedBundles,
        eq(sharedBundleEvents.bundleId, sharedBundles.id),
      )
      .where(
        and(
          or(
            eq(sharedBundleEvents.userId, userId),
            eq(sharedBundles.isDemo, true),
          ),
          or(
            eq(sharedBundles.isDemo, true),
            isNull(sharedBundles.expiresAt),
            gte(sharedBundles.expiresAt, Date.now()),
          ),
          gte(sharedBundleEvents.startTime, weekStart),
          lte(sharedBundleEvents.startTime, weekEnd),
        ),
      ),
    [userId, weekStart, weekEnd],
  );

  const calendarEvents: WeekCalendarEvent[] = useMemo(() => {
    const mine: WeekCalendarEvent[] = localRows
      .filter((row) => !row.label || row.label.isVisible)
      .flatMap((row) =>
        expandEventOccurrences(
          row.event,
          new Date(weekStart),
          new Date(weekEnd),
        ).map((event) => ({
          id: `mine:${event.id}`,
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay,
          color: MY_CALENDAR_COLOR,
          source: MY_CALENDAR_ID,
          editable: false,
          layoutGroupId: MY_CALENDAR_ID,
        })),
      );

    const shared: WeekCalendarEvent[] = sharedRows.map((row) => ({
      id: `shared:${row.event.id}`,
      title: row.event.title,
      startTime: row.event.startTime,
      endTime: row.event.endTime,
      isAllDay: row.event.isAllDay,
      color: row.bundle.color,
      source: row.bundle.id,
      editable: false,
      layoutGroupId: row.bundle.id,
    }));

    return [...mine, ...shared].sort((a, b) => a.startTime - b.startTime);
  }, [localRows, sharedRows, weekEnd, weekStart]);

  const shareLabelOptions = useMemo<ShareLabelOption[]>(
    () =>
      labelList.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
      })),
    [labelList],
  );

  const sharePreviewEvents = useMemo<WeekCalendarEvent[]>(() => {
    if (shareSettingsError) return [];

    const selectedLabels = new Set(shareSettings.selectedLabelIds);

    return shareRows
      .flatMap((row) => {
        if (row.event.labelId) {
          if (!selectedLabels.has(row.event.labelId)) return [];
        } else if (!shareSettings.includeUnlabeled) {
          return [];
        }

        return expandEventOccurrences(
          row.event,
          new Date(shareRange.start),
          new Date(shareRange.end),
        )
          .filter(
            (event) =>
              event.startTime <= shareRange.end && event.endTime >= shareRange.start,
          )
          .map((event) => {
            const overrideKey = getShareOverrideKey(
              event.originalEventId,
              event.occurrenceStartTime,
            );
            const defaultVisibility = resolveShareVisibility(row);
            const visibility =
              shareSettings.eventVisibilityOverrides[overrideKey] ??
              defaultVisibility;

            return {
              id: `share-preview:${event.id}`,
              title: getPreviewTitle(row, visibility),
              startTime: event.startTime,
              endTime: event.endTime,
              isAllDay: event.isAllDay,
              color: row.label?.color ?? MY_CALENDAR_COLOR,
              opacity: visibility === "invisible" ? 0.32 : 1,
              source: row.event.labelId ?? "unlabeled",
              editable: false,
              layoutGroupId: row.event.labelId ?? "unlabeled",
              shareOverrideKey: overrideKey,
              shareVisibility: visibility,
              shareDefaultVisibility: defaultVisibility,
              originalTitle: row.event.title,
            } satisfies WeekCalendarEvent;
          });
      })
      .sort((a, b) => a.startTime - b.startTime);
  }, [
    shareRange.end,
    shareRange.start,
    shareRows,
    shareSettings.eventVisibilityOverrides,
    shareSettings.includeUnlabeled,
    shareSettings.selectedLabelIds,
    shareSettingsError,
  ]);

  const shareIncludedEventCount = useMemo(
    () =>
      sharePreviewEvents.filter(
        (event) => event.shareVisibility !== "invisible",
      ).length,
    [sharePreviewEvents],
  );

  const canSharePreviewPreviousWeek = useMemo(() => {
    if (shareSettingsError) return false;
    return dayjs(sharePreviewWeekKey).isAfter(dayjs(getWeekKey(shareRange.startDate)));
  }, [sharePreviewWeekKey, shareRange.startDate, shareSettingsError]);

  const canSharePreviewNextWeek = useMemo(() => {
    if (shareSettingsError) return false;
    const nextWeekStart = dayjs(addWeeks(sharePreviewWeekKey, 1))
      .startOf("day")
      .valueOf();
    return nextWeekStart <= shareRange.end;
  }, [sharePreviewWeekKey, shareRange.end, shareSettingsError]);

  const sources = useMemo<SharedBundleSource[]>(
    () => [
      {
        id: MY_CALENDAR_ID,
        title: "내 일정",
        subtitle: "로컬 캘린더",
        color: MY_CALENDAR_COLOR,
        canDelete: false,
        canChangeColor: false,
      },
      ...bundleList.map((bundle) => ({
        id: bundle.id,
        title: bundle.title,
        subtitle: formatBundleSubtitle(bundle.ownerName, bundle.expiresAt),
        color: bundle.color,
        canDelete: !bundle.isDemo,
        canChangeColor: true,
      })),
    ],
    [bundleList],
  );

  const createQr = async (settings: ShareQrSettings) => {
    if (!userId || !user) return;

    const range = getShareRange(settings, weekKey);
    const expiryError = getExpiryError(settings);
    if (
      range.error ||
      expiryError ||
      !settings.bundleTitle.trim() ||
      (settings.selectedLabelIds.length === 0 && !settings.includeUnlabeled)
    ) {
      return;
    }

    setIsCreatingQr(true);
    try {
      const result = await createSharedBundleLink({
        userId,
        user,
        weekKey,
        bundleTitle: settings.bundleTitle,
        rangeStart: range.start,
        rangeEnd: range.end,
        selectedLabelIds: settings.selectedLabelIds,
        includeUnlabeled: settings.includeUnlabeled,
        eventVisibilityOverrides: settings.eventVisibilityOverrides,
        expiresAt: getExpiresAt(settings, Date.now()),
      });
      setQr(result);
    } catch {
      Alert.alert("QR 생성 실패", "일정 덩어리 QR을 만들 수 없어요.");
    } finally {
      setIsCreatingQr(false);
    }
  };

  const removeBundle = async (bundleId: string) => {
    await deleteSharedBundle(bundleId, userId);
  };

  const changeBundleColor = async (bundleId: string, color: string) => {
    await updateSharedBundleColor(bundleId, userId, color);
  };

  const cycleSharePreviewEvent = (event: WeekCalendarEvent) => {
    if (!event.shareOverrideKey || !event.shareVisibility) return;

    const nextVisibility = getNextVisibility(event.shareVisibility);
    const overrideKey = event.shareOverrideKey;
    setShareSettings((current) => ({
      ...current,
      eventVisibilityOverrides: {
        ...current.eventVisibilityOverrides,
        [overrideKey]: nextVisibility,
      },
    }));
  };

  return (
    <SharedBundleViewer
      weekKey={weekKey}
      sources={sources}
      events={calendarEvents}
      generatedQr={qr}
      isCreatingQr={isCreatingQr}
      shareLabelOptions={shareLabelOptions}
      shareSettings={shareSettings}
      sharePreviewEvents={sharePreviewEvents}
      shareIncludedEventCount={shareIncludedEventCount}
      sharePreviewWeekKey={sharePreviewWeekKey}
      shareRangeSummary={formatRangeSummary(shareRange)}
      shareExpirySummary={formatExpirySummary(shareSettings)}
      shareSettingsError={shareSettingsError}
      canSharePreviewPreviousWeek={canSharePreviewPreviousWeek}
      canSharePreviewNextWeek={canSharePreviewNextWeek}
      onShareSettingsChange={setShareSettings}
      onSharePreviewPreviousWeek={() =>
        setSharePreviewWeekKey((current) => addWeeks(current, -1))
      }
      onSharePreviewNextWeek={() =>
        setSharePreviewWeekKey((current) => addWeeks(current, 1))
      }
      onSharePreviewEventPress={cycleSharePreviewEvent}
      onCreateQr={createQr}
      onCloseQr={() => {
        setQr(null);
        setShareSettings((current) => ({
          ...current,
          eventVisibilityOverrides: {},
        }));
      }}
      onDeleteSource={removeBundle}
      onChangeSourceColor={changeBundleColor}
      onPreviousWeek={() => setWeekKey((current) => addWeeks(current, -1))}
      onNextWeek={() => setWeekKey((current) => addWeeks(current, 1))}
      onToday={() => setWeekKey(getCurrentWeekKey())}
      onOpenCalendar={() => {
        allowCalendarEntry("shared");
        router.push({
          pathname: "/calendar",
          params: { source: "shared", week: weekKey },
        });
      }}
    />
  );
}

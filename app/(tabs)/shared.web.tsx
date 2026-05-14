import React, { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";

import SharedBundleViewer, {
  type SharedBundleSource,
} from "@/components/SharedBundleViewer";
import type { WeekCalendarEvent } from "@/components/WeekCalendarView";
import { createSharedBundleAppUrl } from "@/services/sharedBundlePayload";
import {
  deleteWebSharedBundle,
  loadWebSharedBundles,
  saveWebSharedBundle,
  updateWebSharedBundleColor,
  type WebStoredSharedBundle,
} from "@/services/sharedBundleWebStorage";
import { allowCalendarEntry } from "@/store/calendarAccess";
import { addWeeks, getCurrentWeekKey } from "@/utils/date";

function formatBundleSubtitle(ownerName: string, expiresAt: number | null) {
  if (!expiresAt) return ownerName;

  const date = new Date(expiresAt);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${ownerName} · ${month}/${day} ${hours}:${minutes} 사라짐`;
}

function openBundleInApp(bundle: WebStoredSharedBundle | undefined) {
  if (!bundle || typeof window === "undefined") return;
  window.location.href = createSharedBundleAppUrl(bundle.encodedBundle);
}

export default function WebSharedScreen() {
  const { bundle, week } = useLocalSearchParams();
  const [weekKey, setWeekKey] = useState(
    typeof week === "string" ? week : getCurrentWeekKey(),
  );
  const [bundles, setBundles] = useState<WebStoredSharedBundle[]>(() =>
    loadWebSharedBundles(),
  );

  useEffect(() => {
    if (typeof week === "string") {
      setWeekKey(week);
    }
  }, [week]);

  useEffect(() => {
    const encodedBundle = Array.isArray(bundle) ? bundle[0] : bundle;
    if (!encodedBundle) return;

    const stored = saveWebSharedBundle(encodedBundle);
    if (!stored) return;

    setBundles(loadWebSharedBundles());
    if (typeof week !== "string") {
      setWeekKey(stored.weekKey);
    }
  }, [bundle, week]);

  useEffect(() => {
    const refreshBundles = () => setBundles(loadWebSharedBundles());
    window.addEventListener("storage", refreshBundles);
    window.addEventListener("nextcon-shared-bundles", refreshBundles);

    return () => {
      window.removeEventListener("storage", refreshBundles);
      window.removeEventListener("nextcon-shared-bundles", refreshBundles);
    };
  }, []);

  const sources = useMemo<SharedBundleSource[]>(
    () =>
      bundles.map((bundle) => ({
        id: bundle.id,
        title: bundle.title,
        subtitle: formatBundleSubtitle(bundle.ownerName, bundle.expiresAt),
        color: bundle.color,
        canDelete: true,
        canChangeColor: true,
      })),
    [bundles],
  );

  const events = useMemo<WeekCalendarEvent[]>(
    () =>
      bundles
        .flatMap((bundle) =>
          bundle.events.map((event, index) => ({
            id: `${bundle.id}:${index}`,
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            isAllDay: event.isAllDay,
            color: bundle.color,
            source: bundle.id,
            editable: false,
            layoutGroupId: bundle.id,
          })),
        )
        .sort((a, b) => a.startTime - b.startTime),
    [bundles],
  );

  const latestBundle = useMemo(
    () =>
      [...bundles].sort((a, b) => b.receivedAt - a.receivedAt)[0],
    [bundles],
  );
  const sourceKey = sources.map((source) => source.id).join(":");

  return (
    <SharedBundleViewer
      key={sourceKey}
      weekKey={weekKey}
      sources={sources}
      events={events}
      emptyText="공유된 일정이 없습니다."
      defaultSelectedSourceIds={sources.map((source) => source.id)}
      onDeleteSource={deleteWebSharedBundle}
      onChangeSourceColor={updateWebSharedBundleColor}
      onOpenApp={latestBundle ? () => openBundleInApp(latestBundle) : undefined}
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

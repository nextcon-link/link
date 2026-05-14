import dayjs from "dayjs";
import { and, eq, isNull } from "drizzle-orm";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import EventForm from "@/components/EventForm";
import { db } from "@/database";
import { events, labels } from "@/database/schema";
import { useAuthStore } from "@/store/auth";
import { getWeekDates, getWeekKey } from "@/utils/date";
import type { EventFormInput, sharingMode } from "@/utils/events";
import { deleteEvent, updateEvent } from "@/utils/eventService";

export default function EditScreen() {
  const userId = useAuthStore((state) => state.user?.id ?? "");
  const { id, week } = useLocalSearchParams<{ id: string; week: string }>();
  const [initialValue, setInitialValue] = useState<EventFormInput | null>(null);
  const [weekDates, setWeekDates] = useState<Date[]>([]);

  useEffect(() => {
    async function loadEvent() {
      const result = await db
        .select({ event: events, label: labels })
        .from(events)
        .leftJoin(
          labels,
          and(
            eq(events.labelId, labels.id),
            eq(labels.userId, userId),
            isNull(labels.deletedAt),
          ),
        )
        .where(and(eq(events.id, id), eq(events.userId, userId)))
        .limit(1);

      if (result.length === 0) { router.back(); return; }

      const { event } = result[0];
      const startD = dayjs(event.startTime);
      const endD   = dayjs(event.endTime);
      const date   = startD.format("YYYY-MM-DD");

      const resolvedWeekKey = week ?? getWeekKey(date);
      setWeekDates(getWeekDates(resolvedWeekKey));

      setInitialValue({
        title:          event.title,
        date,
        startHour:      startD.hour(),
        startMinute:    startD.minute(),
        endHour:        endD.hour(),
        endMinute:      endD.minute(),
        target:         { type: "local" },
        labelId:        event.labelId ?? null,
        recurrenceRule: event.recurrenceRule ?? null,
        sharingMode:   (event.sharingMode as sharingMode) ?? "none",
        // db는 sharingMode가 순혈 Text로, TS에서는 유니온 타입이여서 강제 형변환 해준 겁니다.
      });
    }

    if (id && userId) loadEvent();
  }, [id, userId, week]);

  if (!initialValue) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <EventForm
      mode="edit"
      weekDates={weekDates}
      initialValue={initialValue}
      onSubmit={async (input) => {
        const ok = await updateEvent(id, input);
        if (ok) router.back();
      }}
      onDelete={async () => {
        await deleteEvent(id);
        router.back();
      }}
    />
  );
}

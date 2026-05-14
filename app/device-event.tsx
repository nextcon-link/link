import dayjs from "dayjs";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import EventForm from "@/components/EventForm";
import {
  deleteDeviceCalendarEvent,
  getDeviceCalendarEvent,
  updateDeviceCalendarEvent,
} from "@/services/deviceCalendarCrud";
import { getWeekDates, getWeekKey } from "@/utils/date";
import type { EventFormInput } from "@/utils/events";

export default function DeviceEventScreen() {
  const { id, week } = useLocalSearchParams<{ id: string; week: string }>();
  const [initialValue, setInitialValue] = useState<EventFormInput | null>(null);
  const [weekDates, setWeekDates] = useState<Date[]>([]);

  useEffect(() => {
    async function loadEvent() {
      if (!id) {
        router.back();
        return;
      }

      const event = await getDeviceCalendarEvent(id);
      if (!event) {
        router.back();
        return;
      }

      const startD = dayjs(event.startDate);
      const endD = dayjs(event.endDate);
      const date = startD.format("YYYY-MM-DD");
      const resolvedWeekKey = week ?? getWeekKey(date);

      setWeekDates(getWeekDates(resolvedWeekKey));
      setInitialValue({
        title: event.title ?? "",
        date,
        startHour: startD.hour(),
        startMinute: startD.minute(),
        endHour: endD.hour(),
        endMinute: endD.minute(),
        target: { type: "device", calendarId: event.calendarId },
        labelId: null,
        recurrenceRule: null,
        sharingMode: "none",
      });
    }

    loadEvent();
  }, [id, week]);

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
        const ok = await updateDeviceCalendarEvent(id, input);
        if (ok) router.back();
      }}
      onDelete={async () => {
        await deleteDeviceCalendarEvent(id);
        router.back();
      }}
    />
  );
}

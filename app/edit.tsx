import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";

import EventForm from "../components/EventForm";
import { getCurrentWeekKey, getWeekDates } from "../utils/date";
import type { EventItem } from "../utils/events";
import { deleteEvent, updateEvent } from "../utils/eventService";
import { loadEvents } from "../utils/storage";

export default function EditScreen() {
  const { id, week } = useLocalSearchParams();

  const eventId = String(id);
  const originalWeekKey = week ? String(week) : getCurrentWeekKey();
  const weekDates = getWeekDates(originalWeekKey);

  const [event, setEvent] = useState<EventItem | null>(null);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const allEvents = await loadEvents();
        const found = allEvents[originalWeekKey]?.[eventId];

        if (!found) {
          router.back();
          return;
        }

        setEvent(found);
      };

      load();
    }, [eventId, originalWeekKey]),
  );

  if (!event) {
    return null;
  }

  return (
    <EventForm
      mode="edit"
      titleText="일정 수정"
      weekDates={weekDates}
      initialValue={{
        title: event.title,
        date: event.date,
        startHour: event.startHour,
        startMinute: event.startMinute,
        endHour: event.endHour,
        endMinute: event.endMinute,
        labelId: event.labelId ?? null,
      }}
      onSubmit={async (input) => {
        const ok = await updateEvent(eventId, originalWeekKey, input);

        if (ok) {
          router.back();
        }
      }}
      onDelete={async () => {
        await deleteEvent(eventId, originalWeekKey);
        router.back();
      }}
    />
  );
}

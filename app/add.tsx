import { router, useLocalSearchParams } from "expo-router";
import EventForm from "../components/EventForm";
import { formatDate, getCurrentWeekKey, getWeekDates } from "../utils/date";
import { createEvent } from "../utils/eventService";

export default function AddScreen() {
  const { week } = useLocalSearchParams();
  const weekKey = week ? String(week) : getCurrentWeekKey();
  const weekDates = getWeekDates(weekKey);

  return (
    <EventForm
      mode="add"
      weekDates={weekDates}
      initialValue={{
        title: "",
        date: formatDate(weekDates[0]),
        startHour: 10,
        startMinute: 0,
        endHour: 11,
        endMinute: 0,
        labelId: null,
        recurrenceRule: null,
        sharingMode: 'visible'
      }}
      onSubmit={async (input) => {
        const ok = await createEvent(input);
        if (ok) router.back();
      }}
    />
  );
}

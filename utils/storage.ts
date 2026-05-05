import AsyncStorage from "@react-native-async-storage/async-storage";
import type { EventsByWeek, LabelsById } from "./events";

export async function loadEvents(): Promise<EventsByWeek> {
  try {
    const data = await AsyncStorage.getItem("events");
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export async function saveEvents(events: EventsByWeek) {
  await AsyncStorage.setItem("events", JSON.stringify(events));
}

export async function loadLabels(): Promise<LabelsById> {
  try {
    const data = await AsyncStorage.getItem("labels");
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export async function saveLabels(labels: LabelsById) {
  await AsyncStorage.setItem("labels", JSON.stringify(labels));
}
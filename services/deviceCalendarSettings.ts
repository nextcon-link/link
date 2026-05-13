import AsyncStorage from "@react-native-async-storage/async-storage";
import type * as Calendar from "expo-calendar";

const STORAGE_KEY = "device_calendar_settings_v1";
const LAB_ENABLED_KEY = "device_calendar_lab_enabled_v1";

export type DeviceCalendarProvider =
  | "apple"
  | "google"
  | "samsung"
  | "exchange"
  | "local"
  | "unknown";

export type DeviceCalendarOption = {
  id: string;
  title: string;
  color: string;
  provider: DeviceCalendarProvider;
  sourceName: string | null;
  sourceType: string | null;
  ownerAccount: string | null;
  allowsModifications: boolean;
  selected: boolean;
  disabledReason: "same_google_account" | null;
  mayDuplicateGoogle: boolean;
};

type DeviceCalendarSettings = {
  selections: Record<string, boolean>;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function containsAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

export function detectDeviceCalendarProvider(
  calendar: Calendar.Calendar,
): DeviceCalendarProvider {
  const values = [
    calendar.title,
    calendar.name,
    calendar.ownerAccount,
    calendar.source?.name,
    calendar.source?.type,
    calendar.type,
  ]
    .map(normalize)
    .filter(Boolean);

  const joined = values.join(" ");
  if (containsAny(joined, ["google", "gmail", "com.google"])) return "google";
  if (containsAny(joined, ["samsung", "com.samsung"])) return "samsung";
  if (containsAny(joined, ["icloud", "mobileme", "apple"])) return "apple";
  if (containsAny(joined, ["exchange", "outlook", "office365"])) {
    return "exchange";
  }
  if (calendar.source?.isLocalAccount || containsAny(joined, ["local"])) {
    return "local";
  }

  return "unknown";
}

export function isSameGoogleAccountCalendar(
  calendar: Calendar.Calendar,
  googleEmail: string | null | undefined,
) {
  const email = normalize(googleEmail);
  if (!email) return false;
  if (detectDeviceCalendarProvider(calendar) !== "google") return false;

  return [calendar.ownerAccount, calendar.source?.name, calendar.name]
    .map(normalize)
    .some((value) => value === email || value.includes(email));
}

async function readSettings(): Promise<DeviceCalendarSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { selections: {} };

  try {
    const parsed = JSON.parse(raw) as Partial<DeviceCalendarSettings>;
    return {
      selections:
        parsed.selections && typeof parsed.selections === "object"
          ? parsed.selections
          : {},
    };
  } catch {
    return { selections: {} };
  }
}

async function writeSettings(settings: DeviceCalendarSettings) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function isDeviceCalendarLabEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(LAB_ENABLED_KEY)) === "1";
}

export async function setDeviceCalendarLabEnabled(enabled: boolean) {
  await AsyncStorage.setItem(LAB_ENABLED_KEY, enabled ? "1" : "0");
}

export async function setDeviceCalendarSelected(
  calendarId: string,
  selected: boolean,
) {
  const settings = await readSettings();
  settings.selections[calendarId] = selected;
  await writeSettings(settings);
}

export async function buildDeviceCalendarOptions(
  calendars: Calendar.Calendar[],
  googleStatus: { isConnected: boolean; googleEmail?: string | null } | null,
): Promise<DeviceCalendarOption[]> {
  const settings = await readSettings();

  return calendars.map((calendar) => {
    const provider = detectDeviceCalendarProvider(calendar);
    const sameGoogleAccount =
      Boolean(googleStatus?.isConnected) &&
      isSameGoogleAccountCalendar(calendar, googleStatus?.googleEmail);
    const hasExplicitSelection = Object.prototype.hasOwnProperty.call(
      settings.selections,
      calendar.id,
    );
    const defaultSelected = !sameGoogleAccount;
    const selected = sameGoogleAccount
      ? false
      : hasExplicitSelection
        ? settings.selections[calendar.id]
        : defaultSelected;

    return {
      id: calendar.id,
      title: calendar.title,
      color: calendar.color,
      provider,
      sourceName: calendar.source?.name ?? null,
      sourceType: calendar.source?.type ? String(calendar.source.type) : null,
      ownerAccount: calendar.ownerAccount ?? null,
      allowsModifications: calendar.allowsModifications,
      selected,
      disabledReason: sameGoogleAccount ? "same_google_account" : null,
      mayDuplicateGoogle:
        provider === "google" &&
        Boolean(googleStatus?.isConnected) &&
        !sameGoogleAccount,
    };
  });
}

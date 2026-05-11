import * as Linking from "expo-linking";
import { and, eq, gte, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import * as QRCode from "qrcode";

import { db } from "@/database";
import {
  events,
  labels,
  sharedBundleEvents,
  sharedBundles,
} from "@/database/schema";
import { expandEventOccurrences } from "@/services/recurrence";
import type { sharingMode } from "@/utils/events";
import { generateId } from "@/utils/uuid";

const BLIND_TITLE = "블라인드";
const DEFAULT_BUNDLE_COLOR = "#6C8AE4";
const SHARE_PAYLOAD_VERSION = 2;
type ShareVisibility = "visible" | "blind" | "invisible";

export type SharedBundlePayloadEvent = {
  title: string;
  startTime: number;
  endTime: number;
  isAllDay: boolean;
};

type SharedBundlePayload = {
  v: number;
  id: string;
  title: string;
  ownerName: string;
  color: string;
  weekKey: string;
  expiresAt: number | null;
  createdAt: number;
  events: SharedBundlePayloadEvent[];
};

type LocalEventRow = {
  event: typeof events.$inferSelect;
  label: typeof labels.$inferSelect | null;
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

function resolveSharedTitle(row: LocalEventRow, visibility: ShareVisibility) {
  if (visibility === "visible") return row.event.title;
  if (visibility === "blind") return BLIND_TITLE;
  return null;
}

function getShareOverrideKey(eventId: string, occurrenceStartTime: number) {
  return `${eventId}:${occurrenceStartTime}`;
}

function encodePayload(payload: SharedBundlePayload) {
  return encodeURIComponent(
    JSON.stringify({
      v: payload.v,
      i: payload.id,
      t: payload.title,
      o: payload.ownerName,
      c: payload.color,
      w: payload.weekKey,
      x: payload.expiresAt,
      d: payload.createdAt,
      e: payload.events.map((event) => [
        event.title,
        event.startTime,
        event.endTime,
        event.isAllDay ? 1 : 0,
      ]),
    }),
  );
}

function decodePayload(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(raw);
    const payload = JSON.parse(decoded) as Partial<SharedBundlePayload> & {
      i?: unknown;
      t?: unknown;
      o?: unknown;
      c?: unknown;
      w?: unknown;
      x?: unknown;
      d?: unknown;
      e?: unknown;
    };
    const version = typeof payload.v === "number" ? payload.v : null;
    const id = typeof payload.id === "string" ? payload.id : payload.i;
    const title = typeof payload.title === "string" ? payload.title : payload.t;
    const ownerName =
      typeof payload.ownerName === "string" ? payload.ownerName : payload.o;
    const color = typeof payload.color === "string" ? payload.color : payload.c;
    const weekKey =
      typeof payload.weekKey === "string" ? payload.weekKey : payload.w;
    const expiresAt =
      typeof payload.expiresAt === "number"
        ? payload.expiresAt
        : typeof payload.x === "number"
          ? payload.x
          : null;
    const createdAt =
      typeof payload.createdAt === "number" ? payload.createdAt : payload.d;
    const eventsValue = Array.isArray(payload.events)
      ? payload.events
      : payload.e;

    if (
      (version !== 1 && version !== SHARE_PAYLOAD_VERSION) ||
      typeof id !== "string" ||
      typeof title !== "string" ||
      typeof ownerName !== "string" ||
      typeof color !== "string" ||
      typeof weekKey !== "string" ||
      typeof createdAt !== "number" ||
      !Array.isArray(eventsValue)
    ) {
      return null;
    }

    const decodedEvents: SharedBundlePayloadEvent[] = [];
    for (const event of eventsValue) {
      const candidate = Array.isArray(event)
        ? {
            title: event[0],
            startTime: event[1],
            endTime: event[2],
            isAllDay: event[3],
          }
        : event;

      if (
        !candidate ||
        typeof candidate !== "object" ||
        !("title" in candidate) ||
        !("startTime" in candidate) ||
        !("endTime" in candidate)
      ) {
        continue;
      }

      if (
        typeof candidate.title !== "string" ||
        typeof candidate.startTime !== "number" ||
        typeof candidate.endTime !== "number"
      ) {
        continue;
      }

      decodedEvents.push({
        title: candidate.title,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        isAllDay: Boolean("isAllDay" in candidate ? candidate.isAllDay : false),
      });
    }

    return {
      v: version,
      id,
      title,
      ownerName,
      color,
      weekKey,
      expiresAt,
      createdAt,
      events: decodedEvents,
    } satisfies SharedBundlePayload;
  } catch {
    return null;
  }
}

function createQrMatrix(url: string) {
  const qrCode = QRCode.create(url, {
    errorCorrectionLevel: "M",
  });
  const quietZone = 4;
  const size = qrCode.modules.size + quietZone * 2;

  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const qrRow = row - quietZone;
      const qrCol = col - quietZone;

      if (
        qrRow < 0 ||
        qrCol < 0 ||
        qrRow >= qrCode.modules.size ||
        qrCol >= qrCode.modules.size
      ) {
        return false;
      }

      return qrCode.modules.get(qrRow, qrCol) === 1;
    }),
  );
}

export async function createSharedBundleLink(input: {
  userId: string;
  user: {
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
  weekKey: string;
  bundleTitle: string;
  rangeStart: number;
  rangeEnd: number;
  selectedLabelIds: string[];
  includeUnlabeled: boolean;
  eventVisibilityOverrides: Record<string, ShareVisibility>;
  expiresAt: number | null;
}) {
  const selectedLabels = new Set(input.selectedLabelIds);
  const rows = await db
    .select({
      event: events,
      label: labels,
    })
    .from(events)
    .leftJoin(
      labels,
      and(
        eq(events.labelId, labels.id),
        eq(labels.userId, input.userId),
        isNull(labels.deletedAt),
      ),
    )
    .where(
      and(
        eq(events.userId, input.userId),
        or(
          and(lte(events.startTime, input.rangeEnd), gte(events.endTime, input.rangeStart)),
          and(isNotNull(events.recurrenceRule), lte(events.startTime, input.rangeEnd)),
        ),
        isNull(events.deletedAt),
        ne(events.syncStatus, "pending_delete"),
      ),
    );

  const ownerName = getOwnerName(input.user);
  const payloadEvents = rows
    .flatMap((row) => {
      if (row.event.labelId) {
        if (!selectedLabels.has(row.event.labelId)) return [];
      } else if (!input.includeUnlabeled) {
        return [];
      }

      return expandEventOccurrences(
        row.event,
        new Date(input.rangeStart),
        new Date(input.rangeEnd),
      )
        .filter(
          (event) =>
            event.startTime <= input.rangeEnd && event.endTime >= input.rangeStart,
        )
        .flatMap((event) => {
          const overrideKey = getShareOverrideKey(
            event.originalEventId,
            event.occurrenceStartTime,
          );
          const visibility =
            input.eventVisibilityOverrides[overrideKey] ??
            resolveShareVisibility(row);
          const title = resolveSharedTitle(row, visibility);

          if (!title) return [];

          return {
            title,
            startTime: event.startTime,
            endTime: event.endTime,
            isAllDay: event.isAllDay,
          };
        });
    })
    .sort((a, b) => a.startTime - b.startTime);

  const payload: SharedBundlePayload = {
    v: SHARE_PAYLOAD_VERSION,
    id: generateId(),
    title: input.bundleTitle.trim(),
    ownerName,
    color: DEFAULT_BUNDLE_COLOR,
    weekKey: input.weekKey,
    expiresAt: input.expiresAt,
    createdAt: Date.now(),
    events: payloadEvents,
  };

  const baseUrl = Linking.createURL("shared-bundle");
  const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}bundle=${encodePayload(payload)}`;

  return {
    url,
    qrMatrix: createQrMatrix(url),
    events: payloadEvents,
    eventCount: payloadEvents.length,
    expiresAt: input.expiresAt,
    title: payload.title,
  };
}

export async function importSharedBundleFromUrl(url: string, userId: string) {
  if (!userId) return false;

  const parsed = Linking.parse(url);
  const payload = decodePayload(parsed.queryParams?.bundle);
  if (!payload) return false;

  const localBundleId = `imported_${payload.id}`;
  const now = Date.now();

  await db
    .delete(sharedBundles)
    .where(and(eq(sharedBundles.id, localBundleId), eq(sharedBundles.userId, userId)));

  await db.insert(sharedBundles).values({
    id: localBundleId,
    userId,
    title: payload.title,
    ownerName: payload.ownerName,
    color: payload.color,
    expiresAt: payload.expiresAt,
    isDemo: false,
    createdAt: now,
  });

  for (const [index, event] of payload.events.entries()) {
    await db.insert(sharedBundleEvents).values({
      id: `${localBundleId}_event_${index}`,
      bundleId: localBundleId,
      userId,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      isAllDay: event.isAllDay,
      createdAt: now,
    });
  }

  return true;
}

export async function cleanupExpiredSharedBundles(userId: string) {
  if (!userId) return;

  await db
    .delete(sharedBundles)
    .where(
      and(
        eq(sharedBundles.userId, userId),
        eq(sharedBundles.isDemo, false),
        isNotNull(sharedBundles.expiresAt),
        lte(sharedBundles.expiresAt, Date.now()),
      ),
    );
}

export async function deleteSharedBundle(bundleId: string, userId: string) {
  await db
    .delete(sharedBundles)
    .where(
      and(
        eq(sharedBundles.id, bundleId),
        eq(sharedBundles.userId, userId),
        eq(sharedBundles.isDemo, false),
      ),
    );
}

export async function updateSharedBundleColor(
  bundleId: string,
  userId: string,
  color: string,
) {
  await db
    .update(sharedBundles)
    .set({ color })
    .where(
      and(
        eq(sharedBundles.id, bundleId),
        or(eq(sharedBundles.userId, userId), eq(sharedBundles.isDemo, true)),
      ),
    );
}

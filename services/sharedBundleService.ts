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
import {
  createSharedBundleWebUrl,
  decodeSharedBundlePayload,
  SHARE_PAYLOAD_VERSION,
  type SharedBundlePayload,
  type SharedBundlePayloadEvent,
} from "@/services/sharedBundlePayload";
import { expandEventOccurrences } from "@/services/recurrence";
import type { sharingMode } from "@/utils/events";
import { generateId } from "@/utils/uuid";

const BLIND_TITLE = "블라인드";
const DEFAULT_BUNDLE_COLOR = "#6C8AE4";
type ShareVisibility = "visible" | "blind" | "invisible";

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

  const url = createSharedBundleWebUrl(payload);

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
  const payload = decodeSharedBundlePayload(parsed.queryParams?.bundle);
  if (!payload) return false;

  return importSharedBundlePayload(payload, userId);
}

export async function importSharedBundlePayload(
  payload: SharedBundlePayload,
  userId: string,
) {
  if (!userId) return false;

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

export const SHARE_WEB_BASE_URL = "https://nextcon-link.hurdoo.kr/shared-bundle";
export const SHARE_APP_SCHEME = "nextcon-link";
export const SHARE_APP_BASE_URL = `${SHARE_APP_SCHEME}://shared-bundle`;
export const SHARE_PAYLOAD_VERSION = 2;

export type SharedBundlePayloadEvent = {
  title: string;
  startTime: number;
  endTime: number;
  isAllDay: boolean;
};

export type SharedBundlePayload = {
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

export function encodeSharedBundlePayload(payload: SharedBundlePayload) {
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

export function createSharedBundleWebUrl(payload: SharedBundlePayload) {
  return `${SHARE_WEB_BASE_URL}?bundle=${encodeSharedBundlePayload(payload)}`;
}

export function createSharedBundleAppUrl(encodedBundle: string) {
  return `${SHARE_APP_BASE_URL}?bundle=${encodedBundle}`;
}

export function decodeSharedBundlePayload(value: string | string[] | undefined) {
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

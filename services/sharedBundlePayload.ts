export const SHARE_WEB_BASE_URL = "https://nextcon-link.hurdoo.kr/shared-bundle";
export const SHARE_APP_SCHEME = "nextcon-link";
export const SHARE_APP_BASE_URL = `${SHARE_APP_SCHEME}://shared-bundle`;
export const SHARE_PAYLOAD_VERSION = 3;
const ENCODED_PAYLOAD_PREFIX = "b64.";
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

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

type CompactSharedBundlePayloadV3 = {
  v: 3;
  i: string;
  t: string;
  o: string;
  c: string;
  w: string;
  x: string | null;
  d: string;
  b: string;
  n: string[];
  e: Array<[number, string, string] | [number, string, string, 1]>;
};

function encodeUtf8(value: string) {
  const bytes: number[] = [];

  for (let i = 0; i < value.length; i += 1) {
    let codePoint = value.charCodeAt(i);

    if (
      codePoint >= 0xd800 &&
      codePoint <= 0xdbff &&
      i + 1 < value.length
    ) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        codePoint =
          0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }

  return bytes;
}

function decodeUtf8(bytes: number[]) {
  let result = "";

  for (let i = 0; i < bytes.length; ) {
    const first = bytes[i];
    let codePoint = 0;

    if (first < 0x80) {
      codePoint = first;
      i += 1;
    } else if ((first & 0xe0) === 0xc0) {
      codePoint = ((first & 0x1f) << 6) | (bytes[i + 1] & 0x3f);
      i += 2;
    } else if ((first & 0xf0) === 0xe0) {
      codePoint =
        ((first & 0x0f) << 12) |
        ((bytes[i + 1] & 0x3f) << 6) |
        (bytes[i + 2] & 0x3f);
      i += 3;
    } else {
      codePoint =
        ((first & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      i += 4;
    }

    result += String.fromCodePoint(codePoint);
  }

  return result;
}

function encodeBase64(bytes: number[], alphabet: string, shouldPad: boolean) {
  let output = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const first = bytes[i];
    const second = bytes[i + 1] ?? 0;
    const third = bytes[i + 2] ?? 0;
    const chunk = (first << 16) | (second << 8) | third;

    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    if (i + 1 < bytes.length) {
      output += alphabet[(chunk >> 6) & 63];
    } else if (shouldPad) {
      output += "=";
    }
    if (i + 2 < bytes.length) {
      output += alphabet[chunk & 63];
    } else if (shouldPad) {
      output += "=";
    }
  }

  return output;
}

export function encodeTextAsBase64(value: string) {
  return encodeBase64(encodeUtf8(value), BASE64_ALPHABET, true);
}

function encodeBase64Url(bytes: number[]) {
  return encodeBase64(bytes, BASE64_URL_ALPHABET, false);
}

function decodeBase64Url(value: string) {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of value) {
    const next = BASE64_URL_ALPHABET.indexOf(char);
    if (next === -1) return null;

    buffer = (buffer << 6) | next;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return bytes;
}

function encodeJsonPayload(value: unknown) {
  return `${ENCODED_PAYLOAD_PREFIX}${encodeBase64Url(
    encodeUtf8(JSON.stringify(value)),
  )}`;
}

function decodeJsonPayload(value: string) {
  if (!value.startsWith(ENCODED_PAYLOAD_PREFIX)) return null;

  const bytes = decodeBase64Url(value.slice(ENCODED_PAYLOAD_PREFIX.length));
  if (!bytes) return null;

  try {
    return decodeUtf8(bytes);
  } catch {
    return null;
  }
}

function toBase36(value: number) {
  return Math.round(value).toString(36);
}

function fromBase36(value: unknown) {
  if (typeof value !== "string" || !/^-?[0-9a-z]+$/i.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 36);
  return Number.isFinite(parsed) ? parsed : null;
}

function createCompactPayload(payload: SharedBundlePayload) {
  const titleIndexes = new Map<string, number>();
  const titles: string[] = [];
  const baseTime =
    payload.events.length > 0
      ? Math.min(...payload.events.map((event) => event.startTime))
      : payload.createdAt;

  const compactEvents = payload.events.map((event) => {
    let titleIndex = titleIndexes.get(event.title);
    if (titleIndex === undefined) {
      titleIndex = titles.length;
      titleIndexes.set(event.title, titleIndex);
      titles.push(event.title);
    }

    const compactEvent: [number, string, string] | [number, string, string, 1] =
      [
        titleIndex,
        toBase36(event.startTime - baseTime),
        toBase36(event.endTime - event.startTime),
      ];
    if (event.isAllDay) {
      compactEvent.push(1);
    }
    return compactEvent;
  });

  return {
    v: SHARE_PAYLOAD_VERSION,
    i: payload.id,
    t: payload.title,
    o: payload.ownerName,
    c: payload.color,
    w: payload.weekKey,
    x: payload.expiresAt === null ? null : toBase36(payload.expiresAt),
    d: toBase36(payload.createdAt),
    b: toBase36(baseTime),
    n: titles,
    e: compactEvents,
  } satisfies CompactSharedBundlePayloadV3;
}

export function encodeSharedBundlePayload(payload: SharedBundlePayload) {
  return encodeJsonPayload(createCompactPayload(payload));
}

export function createSharedBundleWebUrl(payload: SharedBundlePayload) {
  return `${SHARE_WEB_BASE_URL}?bundle=${encodeSharedBundlePayload(payload)}`;
}

export function createSharedBundleAppUrl(encodedBundle: string) {
  const payload = decodeSharedBundlePayload(encodedBundle);
  const bundleParam = payload
    ? encodeSharedBundlePayload(payload)
    : encodeURIComponent(encodedBundle);
  return `${SHARE_APP_BASE_URL}?bundle=${bundleParam}`;
}

export function normalizeSharedBundleParam(
  value: string | string[] | undefined,
) {
  const payload = decodeSharedBundlePayload(value);
  return payload ? encodeSharedBundlePayload(payload) : null;
}

export function decodeSharedBundlePayload(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;

  const decodedJsonPayload = decodeJsonPayload(raw);
  const candidates = decodedJsonPayload ? [decodedJsonPayload] : [raw];
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded !== raw) {
      candidates.push(decoded);
    }
  } catch {
    // Some web routers may already pass a decoded JSON string here.
  }

  for (const candidate of candidates) {
    try {
      const decoded = candidate;
      const payload = JSON.parse(decoded) as Partial<SharedBundlePayload> & {
        i?: unknown;
        t?: unknown;
        o?: unknown;
        c?: unknown;
        w?: unknown;
        x?: unknown;
        d?: unknown;
        b?: unknown;
        n?: unknown;
        e?: unknown;
      };
      const version = typeof payload.v === "number" ? payload.v : null;
      const id = typeof payload.id === "string" ? payload.id : payload.i;
      const title =
        typeof payload.title === "string" ? payload.title : payload.t;
      const ownerName =
        typeof payload.ownerName === "string" ? payload.ownerName : payload.o;
      const color =
        typeof payload.color === "string" ? payload.color : payload.c;
      const weekKey =
        typeof payload.weekKey === "string" ? payload.weekKey : payload.w;
      const expiresAt =
        typeof payload.expiresAt === "number"
          ? payload.expiresAt
          : typeof payload.x === "number"
            ? payload.x
            : version === SHARE_PAYLOAD_VERSION && payload.x !== null
              ? fromBase36(payload.x)
              : null;
      const createdAt =
        typeof payload.createdAt === "number"
          ? payload.createdAt
          : version === SHARE_PAYLOAD_VERSION
            ? fromBase36(payload.d)
            : payload.d;
      const eventsValue = Array.isArray(payload.events)
        ? payload.events
        : payload.e;

      if (
        (version !== 1 &&
          version !== 2 &&
          version !== SHARE_PAYLOAD_VERSION) ||
        typeof id !== "string" ||
        typeof title !== "string" ||
        typeof ownerName !== "string" ||
        typeof color !== "string" ||
        typeof weekKey !== "string" ||
        typeof createdAt !== "number" ||
        (expiresAt !== null && typeof expiresAt !== "number") ||
        !Array.isArray(eventsValue)
      ) {
        return null;
      }

      const decodedEvents: SharedBundlePayloadEvent[] = [];
      const baseTime =
        version === SHARE_PAYLOAD_VERSION ? fromBase36(payload.b) : null;
      const titleTable =
        version === SHARE_PAYLOAD_VERSION && Array.isArray(payload.n)
          ? payload.n
          : null;

      for (const event of eventsValue) {
        const candidate =
          version === SHARE_PAYLOAD_VERSION && Array.isArray(event)
            ? {
                title:
                  titleTable && typeof event[0] === "number"
                    ? titleTable[event[0]]
                    : undefined,
                startTime:
                  typeof baseTime === "number"
                    ? baseTime + (fromBase36(event[1]) ?? Number.NaN)
                    : undefined,
                endTime:
                  typeof baseTime === "number"
                    ? baseTime +
                      (fromBase36(event[1]) ?? Number.NaN) +
                      (fromBase36(event[2]) ?? Number.NaN)
                    : undefined,
                isAllDay: event[3],
              }
            : Array.isArray(event)
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
          typeof candidate.endTime !== "number" ||
          !Number.isFinite(candidate.startTime) ||
          !Number.isFinite(candidate.endTime)
        ) {
          continue;
        }

        decodedEvents.push({
          title: candidate.title,
          startTime: candidate.startTime,
          endTime: candidate.endTime,
          isAllDay: Boolean(
            "isAllDay" in candidate ? candidate.isAllDay : false,
          ),
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
      continue;
    }
  }

  return null;
}

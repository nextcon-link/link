import {
  decodeSharedBundlePayload,
  normalizeSharedBundleParam,
  type SharedBundlePayloadEvent,
} from "@/services/sharedBundlePayload";

const STORAGE_KEY = "nextcon.sharedBundles.v1";

export type WebStoredSharedBundle = {
  id: string;
  payloadId: string;
  title: string;
  ownerName: string;
  color: string;
  weekKey: string;
  expiresAt: number | null;
  createdAt: number;
  receivedAt: number;
  encodedBundle: string;
  events: SharedBundlePayloadEvent[];
};

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isExpired(bundle: WebStoredSharedBundle, now = Date.now()) {
  return typeof bundle.expiresAt === "number" && bundle.expiresAt <= now;
}

function parseStoredBundle(value: unknown): WebStoredSharedBundle | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WebStoredSharedBundle>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.payloadId !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.ownerName !== "string" ||
    typeof candidate.color !== "string" ||
    typeof candidate.weekKey !== "string" ||
    typeof candidate.createdAt !== "number" ||
    typeof candidate.receivedAt !== "number" ||
    typeof candidate.encodedBundle !== "string" ||
    !Array.isArray(candidate.events)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    payloadId: candidate.payloadId,
    title: candidate.title,
    ownerName: candidate.ownerName,
    color: candidate.color,
    weekKey: candidate.weekKey,
    expiresAt:
      typeof candidate.expiresAt === "number" ? candidate.expiresAt : null,
    createdAt: candidate.createdAt,
    receivedAt: candidate.receivedAt,
    encodedBundle: candidate.encodedBundle,
    events: candidate.events,
  };
}

function writeBundles(bundles: WebStoredSharedBundle[]) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(bundles));
}

export function loadWebSharedBundles() {
  const storage = getStorage();
  if (!storage) return [];

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const bundles = parsed
      .map(parseStoredBundle)
      .filter((bundle): bundle is WebStoredSharedBundle => Boolean(bundle))
      .filter((bundle) => !isExpired(bundle))
      .sort((a, b) => a.receivedAt - b.receivedAt);

    if (bundles.length !== parsed.length) {
      writeBundles(bundles);
    }

    return bundles;
  } catch {
    return [];
  }
}

export function saveWebSharedBundle(encodedBundle: string) {
  const payload = decodeSharedBundlePayload(encodedBundle);
  const normalizedBundle = normalizeSharedBundleParam(encodedBundle);
  if (!payload || !normalizedBundle) return null;

  const localBundleId = `imported_${payload.id}`;
  const existing = loadWebSharedBundles();
  const previous = existing.find((bundle) => bundle.id === localBundleId);
  const nextBundle: WebStoredSharedBundle = {
    id: localBundleId,
    payloadId: payload.id,
    title: payload.title,
    ownerName: payload.ownerName,
    color: previous?.color ?? payload.color,
    weekKey: payload.weekKey,
    expiresAt: payload.expiresAt,
    createdAt: payload.createdAt,
    receivedAt: Date.now(),
    encodedBundle: normalizedBundle,
    events: payload.events,
  };
  const next = [
    ...existing.filter((bundle) => bundle.id !== localBundleId),
    nextBundle,
  ];

  writeBundles(next);
  window.dispatchEvent(new Event("nextcon-shared-bundles"));
  return nextBundle;
}

export function deleteWebSharedBundle(bundleId: string) {
  const next = loadWebSharedBundles().filter((bundle) => bundle.id !== bundleId);
  writeBundles(next);
  window.dispatchEvent(new Event("nextcon-shared-bundles"));
}

export function updateWebSharedBundleColor(bundleId: string, color: string) {
  const next = loadWebSharedBundles().map((bundle) =>
    bundle.id === bundleId ? { ...bundle, color } : bundle,
  );
  writeBundles(next);
  window.dispatchEvent(new Event("nextcon-shared-bundles"));
}

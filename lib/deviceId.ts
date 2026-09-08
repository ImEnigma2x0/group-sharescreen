"use client";

// A random id for this *device*, in the only sense that matters to a
// notification: one browser profile, one desktop install, one phone.
//
// Deliberately not any of the ids this app already has, because none of them
// answers the question this one exists for — "does the thing I am about to
// wake up already have the app open?":
//
//   - installId (lib/installId.ts) is null in a browser by design, and a
//     browser is exactly where most people receive notifications.
//   - clientId (signalingClient.ts) is sessionStorage and per *tab*, so two
//     tabs of the same laptop would look like two devices and each would be
//     asked to ring.
//   - the account id is the person, and a person is not a place.
//
// What it must be is stable, per browser profile, and worth nothing to steal:
// it grants nothing, proves nothing and is only ever compared against push
// subscriptions the same account registered. Losing it — cleared storage, a
// reinstall — costs one duplicate notification until the new subscription is
// registered under the new id, which happens on the next app open.

const DEVICE_ID_STORAGE_KEY = "sharescreen:deviceId";

function mint(): string {
  try {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // Older WebViews expose crypto without randomUUID — fall through.
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Held in memory as well as in storage so a browser that refuses to persist
// (private mode, a locked WebView profile) still reports *one* id for the life
// of the page instead of a fresh one on every call — which would make every
// device look new and defeat the whole point.
let cached: string | null = null;

/**
 * This device's id, minting one on first call.
 *
 * Null only on the server, where there is no device. Never null in a browser:
 * unlike installId, an id that cannot be stored is still worth having for this
 * session.
 */
export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  if (cached) return cached;
  try {
    const stored = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (stored) {
      cached = stored;
      return cached;
    }
    cached = mint();
    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, cached);
    return cached;
  } catch {
    cached = mint();
    return cached;
  }
}

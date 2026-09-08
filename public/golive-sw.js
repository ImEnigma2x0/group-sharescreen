/* GoLive's service worker.
 *
 * It exists for exactly one reason: to be the part of this app that is still
 * running when none of the rest of it is. A push message wakes it with no
 * page, no React, no session and no guarantee of a network — so everything it
 * needs in order to draw a notification travels *inside* the message, and it
 * never fetches anything.
 *
 * Deliberately not a caching/offline worker. GoLive is a real-time app and is
 * useless without a connection (the same reasoning as electron/main.ts's "this
 * is a shell around the deployed site"), so an offline cache would buy a shell
 * of a page that cannot do anything, at the cost of the single hardest class
 * of bug this codebase could take on — a stale asset served to somebody who
 * has no way to clear it.
 *
 * Plain JavaScript in public/ rather than something the bundler produces: a
 * service worker is fetched by URL, by the browser, outside of everything
 * Next.js does, and a build step between this file and that fetch is a build
 * step that can put a broken worker in front of every user with no way back.
 */

/** Where the notification came from, and what it should look like. */
const DEFAULT_ICON = "/icon.png";

self.addEventListener("install", () => {
  // Take over immediately instead of waiting for every tab of the old worker
  // to close. Nothing here is versioned or cached, so there is no old state
  // for a new worker to be inconsistent with — and waiting would mean a fix
  // to this file reaching people days later.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A push whose body is not our JSON is not ours to draw. Showing a
    // generic notification for it would be worse than silence: it would be an
    // alert nobody can act on.
    return;
  }
  if (!payload || !payload.title) return;

  const isCall = payload.kind === "call";
  const options = {
    body: payload.body || "",
    icon: payload.icon || DEFAULT_ICON,
    badge: DEFAULT_ICON,
    // Same collapse behaviour the in-app notifications use: a burst from one
    // person is one line, and the "call-ended" that follows a ring replaces
    // it rather than leaving a call that is over sitting on the lock screen.
    tag: payload.tag || payload.kind || "golive",
    renotify: true,
    // A ring stays until it is dealt with; a message does not. This is the
    // one place the difference between "somebody is waiting for you right
    // now" and "somebody wrote to you" is expressed to the operating system.
    requireInteraction: isCall,
    // Vibration is the half of a ring that works with the phone on silent.
    vibrate: isCall ? [400, 200, 400, 200, 400] : [120],
    // Handed back on click — it is how the tab that opens knows which call or
    // conversation this was about.
    data: payload,
  };

  event.waitUntil(
    (async () => {
      // A ring that has already been answered somewhere else must not still be
      // ringing here. The "call-ended" push is what says so, and closing the
      // original by its tag is the only way to take a notification back.
      if (payload.kind === "call-ended" && payload.tag) {
        const open = await self.registration.getNotifications({ tag: payload.tag });
        for (const notification of open) notification.close();
      }
      await self.registration.showNotification(payload.title, options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  const payload = event.notification.data || {};
  event.notification.close();

  const target = typeof payload.url === "string" && payload.url.startsWith("/") ? payload.url : "/";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus what is already open rather than opening a second window: the
      // app is a single-page one holding a socket (and possibly a call), and a
      // duplicate tab would be a second connection fighting the first for the
      // same client id.
      for (const client of clients) {
        if (!client.url.startsWith(self.location.origin)) continue;
        await client.focus();
        // Told rather than navigated: navigating throws away the running app
        // — socket, media permissions, whatever room it is in — to show a
        // screen the page can perfectly well open by itself.
        client.postMessage({ source: "golive-sw", type: "notification-click", payload });
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});

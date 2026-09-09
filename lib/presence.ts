"use client";

import { useEffect } from "react";
import { signalingClient, type PeerInfo, type PresenceState } from "./signalingClient";
import { useSignaling } from "./useSignaling";

// Who is around right now — the green/blue dot beside a person's face.
//
// Three states, decided by the server from the connections an account has open
// (see the API's presence sweep):
//
//   "online"     — the app is in front of them somewhere. Green.
//   "background" — connected, but every one of their devices says it is behind
//                  something: minimised, another tab, a phone in a pocket. Blue.
//   "offline"    — no connection at all. No dot.
//
// This module is the only thing components talk to. It exists because the
// subscription is per *connection* while the interest is per *component*: a
// friends list, a chat and a profile dialog can all be showing the same person,
// and each has to be able to appear and disappear without cancelling the
// others. So interest is reference-counted here, and the union is what the
// socket is told.

/** How many mounted components currently want each account id. */
const watchers = new Map<string, number>();

let flushTimer: ReturnType<typeof setTimeout> | null = null;

// Coalesced: a list of forty friends mounts forty components in one render,
// and forty subscription messages for what is one subscription would be silly.
// The delay is a tick's worth, not a real wait — it only has to outlive the
// render that is in progress.
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    signalingClient.watchPresence([...watchers.keys()]);
  }, 50);
}

function retain(id: string) {
  watchers.set(id, (watchers.get(id) ?? 0) + 1);
  scheduleFlush();
}

function release(id: string) {
  const next = (watchers.get(id) ?? 1) - 1;
  if (next > 0) watchers.set(id, next);
  else watchers.delete(id);
  scheduleFlush();
}

/**
 * The presence of one account, kept up to date for as long as the calling
 * component is mounted.
 *
 * Returns null for "no dot": a guest (who has no account and so no presence to
 * ask about), a caller with no id yet, and — importantly — an account whose
 * answer has not arrived. Null and "offline" are deliberately different: the
 * first draws nothing because we do not know, the second draws nothing because
 * we do, and only the second is ever a claim.
 */
export function usePresence(userId?: string | null, isGuest?: boolean): PresenceState | null {
  const enabled = Boolean(userId) && !isGuest;
  const state = useSignaling();

  useEffect(() => {
    if (!enabled || !userId) return;
    retain(userId);
    return () => release(userId);
  }, [enabled, userId]);

  if (!enabled || !userId) return null;
  return state.presence[userId] ?? null;
}

/**
 * The same thing for a whole list at once.
 *
 * A list renders its people in a `.map`, and a hook cannot be called from
 * inside one — so a row that wants a dot would otherwise have to become its own
 * component just to hold a subscription. This keeps the subscription with the
 * list (which is what actually knows who is on screen) and hands back the whole
 * table for rows to index into.
 */
export function usePresenceMap(ids: (string | null | undefined)[]): Record<string, PresenceState> {
  // Joined into a string so the effect's dependency is a value rather than a
  // fresh array on every render — a list that re-renders for an unrelated
  // reason must not re-subscribe.
  const key = ids.filter((id): id is string => Boolean(id)).join(",");
  const state = useSignaling();

  useEffect(() => {
    if (!key) return;
    const list = key.split(",");
    for (const id of list) retain(id);
    return () => {
      for (const id of list) release(id);
    };
  }, [key]);

  return state.presence;
}

/**
 * The presence of somebody in the same room, read from the room itself.
 *
 * A peer is connected by definition — that is what being in the room means —
 * so this needs no subscription and no account: a guest gets a dot here on
 * exactly the same terms as anybody else. It is also the only presence that is
 * *instant*, since the room is told directly when somebody minimises the app
 * (see the API's "peer-app-state").
 */
export function peerPresence(peer: Pick<PeerInfo, "background">): PresenceState {
  return peer.background ? "background" : "online";
}

export const PRESENCE_LABELS: Record<PresenceState, string> = {
  online: "Online",
  background: "Com o app aberto em segundo plano",
  offline: "Offline",
};

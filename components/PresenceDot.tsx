"use client";

import { PRESENCE_LABELS } from "@/lib/presence";
import type { PresenceState } from "@/lib/signalingClient";

// The dot itself. Green for "looking at it", blue for "app open behind
// something", and nothing at all for offline — an absence rather than a grey
// dot, because a grey dot is a thing on the screen that says nothing, and the
// list it appears in is long.
//
// It carries a title and a screen-reader label rather than relying on the
// colour: two dots that differ only in hue are two dots that are the same for
// anyone who cannot tell green from blue, and the difference between them is
// worth reading.

const COLORS: Record<Exclude<PresenceState, "offline">, string> = {
  online: "bg-emerald-500",
  background: "bg-sky-500",
};

export function PresenceDot({
  state,
  size = 10,
  /** Classes for the ring that separates the dot from whatever is behind it —
   *  pass the surface it actually sits on when that is not the page. */
  ringClassName = "ring-white dark:ring-zinc-950",
  className = "",
}: {
  state: PresenceState | null;
  size?: number;
  ringClassName?: string;
  className?: string;
}) {
  if (!state || state === "offline") return null;
  return (
    <span
      role="img"
      aria-label={PRESENCE_LABELS[state]}
      title={PRESENCE_LABELS[state]}
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 rounded-full ring-2 ${COLORS[state]} ${ringClassName} ${className}`}
    />
  );
}

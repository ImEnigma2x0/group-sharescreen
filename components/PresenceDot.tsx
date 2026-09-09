"use client";

import { MdDesktopWindows, MdSmartphone } from "react-icons/md";
import { presenceLabel } from "@/lib/presence";
import type { PresenceInfo, PresenceState } from "@/lib/signalingClient";

// The indicator beside a person's face. Two things at once:
//
//   colour — green while they are looking, blue for a browser tab they are not
//            looking at, yellow for the installed app left running behind
//            something. Nothing at all for offline: an absence rather than a
//            grey dot, because a grey dot is a thing on the screen that says
//            nothing, and the list it appears in is long.
//   shape  — a monitor for the GoLive app on a PC, a phone for anything on a
//            phone, a plain dot for an ordinary desktop browser.
//
// The two are one mark, not a badge on a badge: with a device known, the dot
// *becomes* the glyph, drawn in the state's colour. That keeps the indicator
// the size of a dot instead of the size of a button, which matters because it
// is mostly seen hanging off the corner of a 22-pixel avatar.
//
// The plain dot keeps its surface-coloured ring; the glyph gets none. A ring
// exists to hold a solid circle apart from whatever is behind it, and a
// monitor already has an outline of its own.
//
// Both halves are also written out in the title and the accessible name (see
// presenceLabel): an indicator that differs from its neighbour only by hue, or
// only by silhouette, is the same indicator to somebody who cannot tell the two
// apart.

// One colour per state, as a fill for the plain dot and as ink for the glyph
// that replaces it. Two class names rather than one custom property so the
// palette stays greppable and Tailwind can see every class it has to emit.
const COLORS: Record<Exclude<PresenceState, "offline">, { dot: string; glyph: string }> = {
  online: { dot: "bg-emerald-500", glyph: "text-emerald-500" },
  away: { dot: "bg-sky-500", glyph: "text-sky-500" },
  background: { dot: "bg-amber-400", glyph: "text-amber-400" },
};

const GLYPHS = {
  app: MdDesktopWindows,
  mobile: MdSmartphone,
};

export function PresenceDot({
  presence,
  size = 10,
  /** Classes for the ring that separates the dot from whatever is behind it —
   *  pass the surface it actually sits on when that is not the page. Only the
   *  plain dot takes a ring; a glyph is its own silhouette. */
  ringClassName = "ring-white dark:ring-zinc-950",
  className = "",
}: {
  presence: PresenceInfo | null;
  /** The plain dot's diameter. A glyph is drawn slightly larger, since the same
   *  number of pixels carries a filled circle further than a monitor. */
  size?: number;
  ringClassName?: string;
  className?: string;
}) {
  if (!presence || presence.state === "offline") return null;
  const label = presenceLabel(presence);
  const color = COLORS[presence.state];
  const Glyph = presence.device ? GLYPHS[presence.device] : null;

  if (Glyph) {
    const box = Math.max(11, Math.round(size * 1.2));
    return (
      <Glyph
        role="img"
        aria-label={label}
        title={label}
        style={{ width: box, height: box }}
        className={`shrink-0 ${color.glyph} ${className}`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 rounded-full ring-2 ${color.dot} ${ringClassName} ${className}`}
    />
  );
}

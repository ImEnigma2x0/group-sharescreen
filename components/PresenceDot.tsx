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
// The glyph sits *inside* the coloured circle rather than replacing it. The
// colour is the part read at a glance, in a list, at eleven pixels — turning it
// into a coloured icon would trade the fast signal for the slow one. This way
// the shape is extra for whoever looks twice.
//
// Both halves are also written out in the title and the accessible name (see
// presenceLabel): an indicator that differs from its neighbour only by hue, or
// only by silhouette, is the same indicator to somebody who cannot tell the two
// apart.

const COLORS: Record<Exclude<PresenceState, "offline">, string> = {
  online: "bg-emerald-500",
  away: "bg-sky-500",
  background: "bg-amber-400",
};

const GLYPHS = {
  app: MdDesktopWindows,
  mobile: MdSmartphone,
};

export function PresenceDot({
  presence,
  size = 10,
  /** Classes for the ring that separates the indicator from whatever is behind
   *  it — pass the surface it actually sits on when that is not the page. */
  ringClassName = "ring-white dark:ring-zinc-950",
  className = "",
}: {
  presence: PresenceInfo | null;
  /** The plain dot's diameter. A badge carrying a glyph grows past this on its
   *  own — a monitor drawn at eight pixels is a smudge, not a monitor. */
  size?: number;
  ringClassName?: string;
  className?: string;
}) {
  if (!presence || presence.state === "offline") return null;
  const label = presenceLabel(presence);
  const Glyph = presence.device ? GLYPHS[presence.device] : null;
  const box = Glyph ? Math.max(14, Math.round(size * 1.4)) : size;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{ width: box, height: box }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ring-2 ${
        COLORS[presence.state]
      } ${ringClassName} ${className}`}
    >
      {Glyph && (
        <Glyph
          aria-hidden
          // White on the state colour: the glyph has to survive on three
          // different backgrounds, and it is the one ink that does on all of
          // them without a per-colour exception.
          className="text-white"
          style={{ width: Math.round(box * 0.68), height: Math.round(box * 0.68) }}
        />
      )}
    </span>
  );
}

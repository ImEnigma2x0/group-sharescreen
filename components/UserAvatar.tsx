"use client";

import { useState } from "react";

// One face, drawn the same way everywhere it appears.
//
// The fallback is not decoration. An avatar is `null` for a guest, for an
// account that never picked one, and for a Pro avatar whose subscription has
// lapsed (the API hides those on the way out rather than deleting them) — and
// a preset path can also simply 404 while the image files are still being
// added. All four have to look deliberate rather than broken, so anything
// that does not resolve becomes the person's initial on a colour derived from
// their name: stable per person, so the same face keeps the same colour in
// the participant list and in the chat.

/** Muted enough to sit behind white text without competing with the UI. */
const COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-fuchsia-500",
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initialOf(name: string): string {
  // Codepoint-aware: [...name][0] keeps an emoji or an accented letter whole
  // where name[0] would slice a surrogate pair into a replacement character.
  return ([...name.trim()][0] ?? "?").toUpperCase();
}

export function UserAvatar({
  src,
  name,
  size = 24,
  className = "",
}: {
  src?: string | null;
  name: string;
  /** Rendered size in pixels — the circle is always square. */
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  // Keyed on the source so a person changing their picture mid-call gets a
  // fresh attempt instead of inheriting the previous one's failure.
  const [loadedSrc, setLoadedSrc] = useState(src);
  if (loadedSrc !== src) {
    setLoadedSrc(src);
    setFailed(false);
  }

  const style = { width: size, height: size };
  const shared = `shrink-0 rounded-full object-cover ${className}`;

  if (!src || failed) {
    return (
      <span
        aria-hidden
        style={style}
        className={`flex items-center justify-center font-semibold text-white ${colorFor(name)} ${shared}`}
      >
        <span style={{ fontSize: Math.round(size * 0.45), lineHeight: 1 }}>{initialOf(name)}</span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- the source is a
    // user-chosen CDN URL or a static preset, neither of which next/image can
    // optimise without a remote-pattern list that changes with the CDN.
    <img
      src={src}
      alt=""
      style={style}
      onError={() => setFailed(true)}
      className={`bg-zinc-200 dark:bg-zinc-800 ${shared}`}
    />
  );
}

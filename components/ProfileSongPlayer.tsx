"use client";

import { useState } from "react";
import { MdPlayArrow } from "react-icons/md";

// The song on somebody's profile.
//
// Two behaviours, one component, because they are the same player with a
// different starting state — splitting them would be two places to fix the
// day the embed changes:
//
//   - on the profile page (/user/...), it starts on its own;
//   - in the room's profile popup, it waits for a press. Somebody clicking a
//     name mid-call to check who they are must not have music start over the
//     call they are in.
//
// What the browser does about autoplay is not ours to decide: an embed that
// has never been interacted with is usually allowed to start muted and
// usually blocked with sound. So the player is always *visible* — if it was
// stopped, the person can press play, which is exactly the control a hidden
// autoplaying audio source would deny them.

export interface ProfileSong {
  videoId: string;
  title: string;
}

export function ProfileSongPlayer({
  song,
  autoPlay = false,
  className = "",
}: {
  song: ProfileSong;
  autoPlay?: boolean;
  className?: string;
}) {
  const [playing, setPlaying] = useState(autoPlay);
  const title = song.title || "Música do perfil";

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className={`flex w-full items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 ${className}`}
      >
        <MdPlayArrow className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-500" />
        <span className="min-w-0 truncate">{title}</span>
      </button>
    );
  }

  return (
    <div className={`overflow-hidden rounded-lg ${className}`}>
      <iframe
        // youtube-nocookie, and only ever an id this app parsed out of a link
        // (see the API's profileSong.ts) — never a URL somebody stored.
        src={`https://www.youtube-nocookie.com/embed/${song.videoId}?autoplay=1&rel=0&modestbranding=1`}
        title={title}
        // No `allow="autoplay"` omission and no fullscreen: this is a song on
        // a profile, and a video that can take over the screen is not what
        // anybody asked for by pressing play on a name.
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
        className="h-20 w-full border-0"
      />
    </div>
  );
}

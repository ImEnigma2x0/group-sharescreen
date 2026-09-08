"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

// Whether the Pro subscription modal is open, managed as a single global store
// so any trigger in the app (room header, quality picker, user profile, etc.)
// can open the modal without prop drilling.

type ModalState = { open: boolean };

let state: ModalState = { open: false };
const listeners = new Set<() => void>();

function set(next: ModalState) {
  state = next;
  for (const listener of listeners) listener();
}

/** Opens the GoLive Pro modal. */
export function openProModal(): void {
  set({ open: true });
}

/** Closes the GoLive Pro modal. */
export function closeProModal(): void {
  if (!state.open) return;
  set({ open: false });
}

const SERVER_STATE: ModalState = { open: false };

export function useProModal(): ModalState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => state,
    () => SERVER_STATE
  );
}

/**
 * Opens Pro the right way for where the caller is.
 *
 * The modal exists for one situation: inside a room, where following a link
 * would tear down the call to read a price. Everywhere else the page is the
 * better answer — it has a URL somebody can share or come back to, a back
 * button, and room to breathe — and a modal there was the site denying all
 * three for no reason.
 *
 * The room is the only place with that constraint, so the room is the only
 * place that gets the modal.
 */
export function useOpenPro(): () => void {
  const pathname = usePathname();
  const router = useRouter();
  return () => {
    if (pathname?.startsWith("/watch/")) {
      openProModal();
      return;
    }
    router.push("/pro");
  };
}

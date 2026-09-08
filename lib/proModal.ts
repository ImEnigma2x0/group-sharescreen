"use client";

import { useSyncExternalStore } from "react";

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


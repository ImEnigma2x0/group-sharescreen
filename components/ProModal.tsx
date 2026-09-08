"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ProPanel } from "@/app/pro/ProPanel";

export interface ProModalProps {
  open: boolean;
  onClose: () => void;
}

const subscribeNothing = () => () => {};

export function ProModal({ open, onClose }: ProModalProps) {
  const onClient = useSyncExternalStore(subscribeNothing, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!onClient || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="GoLive Pro"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50 shadow-2xl dark:border-zinc-800 dark:bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <ProPanel isModal onClose={onClose} />
      </div>
    </div>,
    document.body
  );
}


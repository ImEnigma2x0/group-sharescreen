"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  MdClose,
  MdOpenInNew,
  MdDownload,
  MdChevronLeft,
  MdChevronRight,
} from "react-icons/md";

export interface ChatImagePreviewState {
  src: string;
  alt?: string;
  images?: string[];
  currentIndex?: number;
}

export interface ChatImageModalProps {
  preview: ChatImagePreviewState | null;
  onClose: () => void;
}

const subscribeNothing = () => () => {};

export function ChatImageModal({ preview, onClose }: ChatImageModalProps) {
  const onClient = useSyncExternalStore(subscribeNothing, () => true, () => false);

  const images = preview?.images && preview.images.length > 0 ? preview.images : preview?.src ? [preview.src] : [];
  const [prevSrc, setPrevSrc] = useState<string | null>(preview?.src ?? null);
  const [index, setIndex] = useState(preview?.currentIndex ?? 0);

  if (preview && preview.src !== prevSrc) {
    setPrevSrc(preview.src);
    setIndex(preview.currentIndex ?? 0);
  }

  const hasMultiple = images.length > 1;
  const currentSrc = images[index] ?? preview?.src ?? "";

  const showPrev = useCallback(() => {
    if (!images.length) return;
    setIndex((curr) => (curr - 1 + images.length) % images.length);
  }, [images.length]);

  const showNext = useCallback(() => {
    if (!images.length) return;
    setIndex((curr) => (curr + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!preview) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (hasMultiple && e.key === "ArrowLeft") {
        showPrev();
      } else if (hasMultiple && e.key === "ArrowRight") {
        showNext();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [preview, hasMultiple, onClose, showPrev, showNext]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!preview) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [preview]);

  if (!onClient || !preview || !currentSrc) return null;

  function handleDownload(url: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = `chat-image-${Date.now()}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Visualização de imagem"
    >
      {/* Top action bar */}
      <div className="absolute top-4 inset-x-4 flex items-center justify-between pointer-events-none z-10">
        <div className="pointer-events-auto flex items-center gap-2">
          {hasMultiple && (
            <span className="rounded-full bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-200 backdrop-blur border border-white/10 shadow-lg">
              {index + 1} / {images.length}
            </span>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <a
            href={currentSrc}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir imagem original em nova guia"
            aria-label="Abrir imagem original em nova guia"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-200 transition hover:bg-zinc-800 hover:text-white backdrop-blur border border-white/10 shadow-lg"
          >
            <MdOpenInNew className="h-5 w-5" />
          </a>
          <button
            type="button"
            onClick={() => handleDownload(currentSrc)}
            title="Baixar imagem"
            aria-label="Baixar imagem"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-zinc-900/80 text-zinc-200 transition hover:bg-zinc-800 hover:text-white backdrop-blur border border-white/10 shadow-lg"
          >
            <MdDownload className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Fechar (Esc)"
            aria-label="Fechar"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-zinc-900/80 text-zinc-200 transition hover:bg-zinc-800 hover:text-white backdrop-blur border border-white/10 shadow-lg"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation arrows for multiple images */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              showPrev();
            }}
            title="Imagem anterior (Seta para esquerda)"
            aria-label="Imagem anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-zinc-900/80 text-zinc-200 transition hover:bg-zinc-800 hover:text-white backdrop-blur border border-white/10 shadow-lg z-10"
          >
            <MdChevronLeft className="h-7 w-7" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              showNext();
            }}
            title="Próxima imagem (Seta para direita)"
            aria-label="Próxima imagem"
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-zinc-900/80 text-zinc-200 transition hover:bg-zinc-800 hover:text-white backdrop-blur border border-white/10 shadow-lg z-10"
          >
            <MdChevronRight className="h-7 w-7" />
          </button>
        </>
      )}

      {/* Image Container */}
      <div
        className="relative flex items-center justify-center max-h-[85vh] max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={currentSrc}
          src={currentSrc}
          alt={preview.alt || "Imagem do chat"}
          className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain shadow-2xl transition-all"
        />
      </div>
    </div>,
    document.body
  );
}

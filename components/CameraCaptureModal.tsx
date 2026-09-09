"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MdCameraAlt, MdClose, MdFlipCameraAndroid } from "react-icons/md";

const subscribeNothing = () => () => {};

// What the picture is encoded as on the way out. JPEG rather than PNG because
// this is a photograph, and the chat's own downscale (prepareChatImage) will
// re-encode it anyway — this only has to be small enough not to be silly and
// good enough that the re-encode has something to work with.
const CAPTURE_MIME = "image/jpeg";
const CAPTURE_QUALITY = 0.92;

function describeCameraError(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as Error).name) : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Permissão de câmera negada. Libere o acesso nas configurações do navegador.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "Nenhuma câmera encontrada neste dispositivo.";
  }
  if (name === "NotReadableError") {
    return "A câmera já está em uso por outro aplicativo.";
  }
  return "Não foi possível abrir a câmera.";
}

// Takes a picture with the device's camera and hands it back as a File, so the
// caller can treat it exactly like something picked from disk. Live preview
// rather than a bare `capture` attribute on the file input: that attribute is
// ignored on desktop, where a webcam is just as much a camera as a phone's is.
export function CameraCaptureModal({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  // Fired once, with the still. The modal closes itself right after.
  onCapture: (file: File) => void;
}) {
  const onClient = useSyncExternalStore(subscribeNothing, () => true, () => false);

  const videoRef = useRef<HTMLVideoElement>(null);
  // The live stream, kept in a ref rather than state: nothing renders from it,
  // and the cleanup below has to be able to stop whichever stream is current
  // without waiting for a re-render.
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  // Only worth offering the flip button where there is something to flip to —
  // a laptop with one webcam shouldn't show a control that does nothing.
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Opens the camera while the modal is up, and — just as importantly — puts
  // the light out again the moment it isn't. Re-runs on a flip, which is what
  // swaps the front camera for the back one.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);
    setError(null);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error("unsupported"), { name: "NotFoundError" });
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        stopStream();
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {}
        }
        if (!cancelled) setReady(true);

        // Only after permission has been granted: before that, labels and
        // even the device list are withheld, so counting cameras first would
        // undercount and hide the flip button on the phones that need it.
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (!cancelled) {
            setHasMultipleCameras(
              devices.filter((d) => d.kind === "videoinput").length > 1
            );
          }
        } catch {}
      } catch (err) {
        if (!cancelled) {
          setError(describeCameraError(err));
          setReady(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, facingMode, stopStream]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // The front camera is shown mirrored, the way every camera app shows it —
  // so the still is mirrored too, otherwise the picture taken is not the
  // picture that was framed.
  const mirrored = facingMode === "user";

  async function takePhoto() {
    const video = videoRef.current;
    if (!video || !ready || capturing) return;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Não foi possível capturar a foto.");
        return;
      }
      if (mirrored) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, CAPTURE_MIME, CAPTURE_QUALITY)
      );
      if (!blob) {
        setError("Não foi possível capturar a foto.");
        return;
      }
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: CAPTURE_MIME });
      onCapture(file);
      onClose();
    } finally {
      setCapturing(false);
    }
  }

  if (!onClient || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Tirar uma foto"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Tirar uma foto</h2>
          <button
            type="button"
            onClick={onClose}
            title="Fechar (Esc)"
            aria-label="Fechar"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-zinc-900/80 text-zinc-200 backdrop-blur transition hover:bg-zinc-800 hover:text-white"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full w-full object-contain ${mirrored ? "-scale-x-100" : ""}`}
          />
          {!ready && !error && (
            <span
              aria-hidden
              className="absolute h-8 w-8 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent"
            />
          )}
          {error && (
            <p className="absolute max-w-sm px-6 text-center text-sm text-red-300">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          {hasMultipleCameras && (
            <button
              type="button"
              onClick={() => setFacingMode((mode) => (mode === "user" ? "environment" : "user"))}
              title="Alternar câmera"
              aria-label="Alternar câmera"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-zinc-900/80 text-zinc-200 backdrop-blur transition hover:bg-zinc-800 hover:text-white"
            >
              <MdFlipCameraAndroid className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={takePhoto}
            disabled={!ready || capturing}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MdCameraAlt className="h-5 w-5" aria-hidden />
            Tirar foto
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

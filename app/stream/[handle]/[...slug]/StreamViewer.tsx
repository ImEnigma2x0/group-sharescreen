"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSignaling } from "@/lib/useSignaling";
import { useRoomMedia } from "@/lib/useRoomMedia";
import { signalingClient } from "@/lib/signalingClient";
import { VideoSourceTile } from "@/components/VideoSourceTile";
import { ObsSourceIcon, CheckIcon } from "@/components/icons";
import { verifyObsSecurityToken, type ObsTokenPayload } from "@/lib/obsToken";
import { isBroadcastSoftware } from "@/lib/browserEnv";
import { copyText } from "@/lib/clipboard";
import { MdContentCopy } from "react-icons/md";

export function normalizeSlugToTile(slug: string[]): {
  kind: "screen" | "camera" | "file" | "video-source";
  ownerId: string;
} | null {
  if (!slug || slug.length === 0) return null;

  if (slug.length === 1) {
    const raw = decodeURIComponent(slug[0]);
    if (raw.startsWith("screen:")) return { kind: "screen", ownerId: raw.slice(7) };
    if (raw.startsWith("camera:")) return { kind: "camera", ownerId: raw.slice(7) };
    if (raw.startsWith("file:")) return { kind: "file", ownerId: raw.slice(5) };
    if (raw.startsWith("video-source:")) return { kind: "video-source", ownerId: raw.slice(13) };
    return { kind: "screen", ownerId: raw };
  }

  if (slug.length === 2) {
    const [first, second] = slug.map(decodeURIComponent);
    if (second === "screen" || second === "camera") {
      return { kind: second, ownerId: first };
    }
    if (first === "screen" || first === "camera") {
      return { kind: first, ownerId: second };
    }
    if (first === "video-source") {
      return { kind: "video-source", ownerId: second };
    }
    if (second.startsWith("file")) {
      return { kind: "file", ownerId: `${second}:${first}` };
    }
    return { kind: "screen", ownerId: first };
  }

  if (slug.length >= 3) {
    const [a, b, c] = slug.map(decodeURIComponent);
    if (a === "file") {
      return { kind: "file", ownerId: `${b}:${c}` };
    }
    if (b === "file") {
      return { kind: "file", ownerId: `${c}:${a}` };
    }
  }

  return null;
}

export function StreamViewer({
  handle,
  slug,
}: {
  handle: string;
  slug: string[];
}) {
  const [mounted, setMounted] = useState(false);
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isBroadcastSoftware()) {
      setIsBroadcast(true);
      return;
    }
    const handleObsInit = () => {
      setIsBroadcast(true);
    };
    window.addEventListener("obsStudioInit", handleObsInit);
    return () => window.removeEventListener("obsStudioInit", handleObsInit);
  }, []);

  const state = useSignaling();
  // Only connect room media if we are in actual broadcast software
  const {
    remoteStreams,
    remoteCameraStreams,
    fileChannels,
  } = useRoomMedia(isBroadcast ? handle : "");

  const videoRef = useRef<HTMLVideoElement>(null);
  const parsed = useMemo(() => normalizeSlugToTile(slug), [slug]);

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("token");
  }, []);

  const [tokenStatus, setTokenStatus] = useState<{
    checking: boolean;
    valid: boolean;
    payload?: ObsTokenPayload;
    error?: string;
  }>({
    checking: true,
    valid: false,
  });

  useEffect(() => {
    if (!token) {
      setTokenStatus({ checking: false, valid: false, error: "Token não fornecido." });
      return;
    }
    let cancelled = false;
    void verifyObsSecurityToken(token, handle).then((res) => {
      if (cancelled) return;
      setTokenStatus({
        checking: false,
        valid: res.valid,
        payload: res.payload,
        error: res.error,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [token, handle]);

  const defaultStreamName = useMemo(
    () => `Stream-${Math.floor(100 + Math.random() * 900)}`,
    []
  );

  // 1. Ensure the WebSocket connection is open (only in broadcast software with valid token)
  useEffect(() => {
    if (!isBroadcast || !tokenStatus.valid) return;
    signalingClient.connect();
  }, [isBroadcast, tokenStatus.valid]);

  // 2. Ensure an identity is registered
  useEffect(() => {
    if (!isBroadcast || !tokenStatus.valid) return;
    if (!state.name) {
      signalingClient.register(defaultStreamName);
    }
  }, [isBroadcast, tokenStatus.valid, state.name, defaultStreamName]);

  // 3. Join the room once state.name is ready
  useEffect(() => {
    if (!isBroadcast || !state.name || !tokenStatus.valid) return;
    const obsTarget = parsed ? `${parsed.kind}:${parsed.ownerId}` : null;
    signalingClient.joinRoom(handle, true, token, obsTarget);

    return () => {
      signalingClient.leaveRoom();
    };
  }, [isBroadcast, handle, state.name, tokenStatus.valid, token, parsed]);

  const [retryCount, setRetryCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Reset retry count once room is joined
  useEffect(() => {
    if (state.room) {
      setRetryCount(0);
      setCountdown(null);
    }
  }, [state.room]);

  const handleManualRetry = useCallback(() => {
    setCountdown(null);
    const obsTarget = parsed ? `${parsed.kind}:${parsed.ownerId}` : null;
    signalingClient.joinRoom(handle, true, token, obsTarget);
  }, [handle, token, parsed]);

  // 4. Notify peers that this stream is actively captured by OBS
  useEffect(() => {
    if (!isBroadcast || !tokenStatus.valid || !parsed || !state.room) return;
    const target = `${parsed.kind}:${parsed.ownerId}`;
    const broadcastActive = () => {
      for (const peer of state.peers) {
        if (peer.id !== state.selfId) {
          signalingClient.sendSignal(peer.id, {
            type: "obs-stream-active",
            target,
          });
        }
      }
    };
    broadcastActive();
    const interval = setInterval(broadcastActive, 12000);
    return () => clearInterval(interval);
  }, [isBroadcast, tokenStatus.valid, parsed, state.room, state.peers, state.selfId]);

  // 5. Auto-confirm device conflict
  useEffect(() => {
    if (!isBroadcast || !state.deviceConflict) return;
    signalingClient.confirmDeviceJoin();
  }, [isBroadcast, state.deviceConflict]);

  // 6. Intelligent backoff retry on joinError
  useEffect(() => {
    if (!isBroadcast || !tokenStatus.valid || !state.name || !state.joinError || state.room) {
      setCountdown(null);
      return;
    }

    const delaySeconds =
      state.joinErrorKind === "rate-limited"
        ? Math.min(30, 15 + retryCount * 5)
        : Math.min(20, 8 + retryCount * 3);

    setCountdown(delaySeconds);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setRetryCount((c) => c + 1);
          const obsTarget = parsed ? `${parsed.kind}:${parsed.ownerId}` : null;
          signalingClient.joinRoom(handle, true, token, obsTarget);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isBroadcast, tokenStatus.valid, state.name, state.joinError, state.joinErrorKind, state.room, handle, token, parsed, retryCount]);

  const authorId = tokenStatus.payload?.authorId;
  const authorName = tokenStatus.payload?.authorName;
  const isAuthorPresent = useMemo(() => {
    if (!authorId) return false;
    return state.peers.some((p) => p.userId === authorId || p.id === authorId);
  }, [authorId, state.peers]);

  // Resolve the active stream from target peer
  const stream = useMemo<MediaStream | null>(() => {
    if (!isBroadcast || !parsed) return null;

    const targetPeer = state.peers.find(
      (p) => p.id === parsed.ownerId || (p.userId && p.userId === parsed.ownerId)
    );
    const resolvedPeerId = targetPeer ? targetPeer.id : parsed.ownerId;

    if (parsed.kind === "screen") {
      return remoteStreams[resolvedPeerId] ?? null;
    }
    if (parsed.kind === "camera") {
      return remoteCameraStreams[resolvedPeerId] ?? null;
    }
    if (parsed.kind === "file") {
      const fileSep = parsed.ownerId.indexOf(":");
      if (fileSep < 0) return null;
      const slot = parsed.ownerId.slice(0, fileSep);
      const fileOwner = parsed.ownerId.slice(fileSep + 1);
      const peer = state.peers.find(
        (p) => p.id === fileOwner || (p.userId && p.userId === fileOwner)
      );
      const targetFilePeerId = peer ? peer.id : fileOwner;
      const channel = fileChannels[slot as keyof typeof fileChannels];
      return channel?.remoteStreams?.[targetFilePeerId] ?? null;
    }
    return null;
  }, [isBroadcast, parsed, state.peers, remoteStreams, remoteCameraStreams, fileChannels]);

  // Connect stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!stream) {
      video.srcObject = null;
      return;
    }
    video.srcObject = stream;
    video.play().catch((err) => {
      console.warn("Autoplay in broadcast source failed:", err);
    });
  }, [stream]);

  const handleCopyLink = useCallback(async () => {
    if (typeof window === "undefined") return;
    await copyText(window.location.href);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  }, []);

  // --------------------------------------------------------------------------
  // BROWSER BLOCK SCREEN: If opened in a regular web browser, block video playback!
  // --------------------------------------------------------------------------
  if (mounted && !isBroadcast) {
    return (
      <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-zinc-950 p-6 text-white">
        <div className="relative w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900/90 p-7 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3.5 mb-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shadow-inner">
              <ObsSourceIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-purple-300">
                Software de Transmissão
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight sm:text-2xl mt-0.5">
                Transmissão Bloqueada no Navegador
              </h1>
            </div>
          </div>

          <p className="text-sm text-zinc-300 leading-relaxed">
            Por questões de segurança e desempenho, este link <strong>não reproduz vídeo diretamente no navegador</strong>. Ele foi desenvolvido exclusivamente para ser capturado como <strong>Fonte de Navegador (Browser Source)</strong> em programas de transmissão.
          </p>

          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-xs">
              <p className="font-semibold text-zinc-200 mb-2.5 flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-600/30 text-purple-300 text-xs font-bold">1</span>
                Como usar no OBS Studio / Streamlabs / vMix:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-zinc-400 pl-1 leading-relaxed">
                <li>Abra o seu software de transmissão (ex: <strong>OBS Studio</strong>).</li>
                <li>Na lista de <strong>Fontes (Sources)</strong>, clique no botão <strong>+</strong> e selecione <strong>Navegador (Browser Source)</strong>.</li>
                <li>Copie a URL deste link no botão abaixo e cole no campo <strong>URL</strong> da fonte.</li>
                <li>Defina a resolução para <strong className="text-zinc-200">1920x1080</strong> e clique em <strong>OK</strong>.</li>
              </ol>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`flex w-full sm:flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] ${
                copiedUrl
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                  : "bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-600/25"
              }`}
            >
              {copiedUrl ? (
                <>
                  <CheckIcon className="h-4 w-4" />
                  Link copiado com sucesso!
                </>
              ) : (
                <>
                  <MdContentCopy className="h-4 w-4" />
                  Copiar link para o OBS
                </>
              )}
            </button>

            <Link
              href={`/watch/${encodeURIComponent(handle)}`}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700 hover:text-white active:scale-[0.98]"
            >
              Ir para a sala
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Handle video-source tiles (YouTube/Twitch/Kick iframe)
  if (parsed?.kind === "video-source") {
    const videoSource = state.videoSources?.find(
      (s: { id: string }) => s.id === parsed.ownerId
    );
    if (!videoSource) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-transparent font-sans text-sm text-zinc-400">
          Aguardando vídeo...
        </div>
      );
    }

    return (
      <div className="h-screen w-screen overflow-hidden bg-transparent">
        <VideoSourceTile
          source={videoSource}
          canControl={false}
          isOwner={false}
          onStateChange={() => {}}
          onRemove={() => {}}
          onLeave={() => {}}
          label=""
          fill
          className="!rounded-none !border-0"
        />
      </div>
    );
  }

  // Check token status
  if (mounted && tokenStatus.checking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-transparent font-sans text-xs text-zinc-400">
        Verificando credenciais de acesso...
      </div>
    );
  }

  // Require a valid security token
  if (mounted && !tokenStatus.valid) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center text-white">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-white">
          {!token ? "Token de Segurança Necessário" : "Token Inválido ou Expirado"}
        </h2>
        <p className="max-w-sm text-xs leading-relaxed text-zinc-400">
          {tokenStatus.error ??
            "Este link de transmissão requer um token de acesso válido gerado na sala pelo administrador com o Modo Streamer ativado."}
        </p>
      </div>
    );
  }

  // Display join errors if any (e.g. streamer mode disabled, full room, banned, etc.)
  if (state.joinError) {
    const isStreamerModeDisabled =
      state.joinErrorKind === "streamer-mode-disabled" ||
      state.joinError.includes("Modo Streamer");

    if (isStreamerModeDisabled) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400">
            <ObsSourceIcon className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-white">Modo Streamer Desativado</h2>
          <p className="max-w-sm text-xs leading-relaxed text-zinc-400">
            A imagem desta transmissão está pausada porque o administrador não ativou o Modo Streamer na sala. A transmissão iniciará automaticamente assim que o Modo Streamer for ativado.
          </p>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-500" />
              </span>
              {countdown !== null
                ? `Próxima tentativa em ${countdown}s...`
                : "Aguardando ativação pelo administrador..."}
            </div>
            <button
              type="button"
              onClick={handleManualRetry}
              className="mt-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white active:scale-95 transition-all"
            >
              Tentar agora
            </button>
          </div>
        </div>
      );
    }

    const isRateLimited = state.joinErrorKind === "rate-limited";

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center text-white">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-white">
          {isRateLimited ? "Muitas Tentativas" : "Acesso Não Autorizado"}
        </h2>
        <p className="max-w-sm text-xs leading-relaxed text-zinc-400">
          {state.joinError}
        </p>
        <div className="flex flex-col items-center gap-2">
          {countdown !== null && (
            <p className="text-[11px] text-zinc-500">
              Reconectando automaticamente em {countdown}s...
            </p>
          )}
          <button
            type="button"
            onClick={handleManualRetry}
            className="rounded-lg bg-zinc-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 active:scale-95"
          >
            Tentar agora
          </button>
        </div>
      </div>
    );
  }

  if (!state.room) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-transparent font-sans text-sm text-zinc-400">
        <p>Conectando à transmissão...</p>
        {state.deviceConflict && (
          <p className="text-xs text-amber-300">Confirmando conexão de dispositivo...</p>
        )}
      </div>
    );
  }

  if (mounted && !isAuthorPresent) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center text-white">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-white">Aguardando Administrador</h2>
        <p className="max-w-sm text-xs leading-relaxed text-zinc-400">
          O administrador {authorName ? `(${authorName})` : ""} que gerou este link não está conectado na chamada. A transmissão continuará automaticamente assim que ele entrar na sala.
        </p>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-transparent font-sans text-sm text-zinc-400">
        <p>Aguardando transmissão de vídeo...</p>
        <span className="text-xs text-zinc-500">
          {parsed?.ownerId} ({parsed?.kind ?? "mídia"})
        </span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden bg-transparent">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full object-contain bg-transparent"
      />
    </div>
  );
}


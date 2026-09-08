"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MdCall, MdCallEnd } from "react-icons/md";
import { useAuth } from "@/lib/AuthContext";
import { useSignaling } from "@/lib/useSignaling";
import { signalingClient } from "@/lib/signalingClient";
import { acceptCall, endCall, fetchPendingCalls } from "@/lib/callsApi";
import { showNotification } from "@/lib/notifications";
import { getDesktopBridge } from "@/lib/desktop";
import { startRingtone, stopRingtone } from "@/lib/soundEffects";
import { UserAvatar } from "@/components/UserAvatar";

// The ringing screen — both directions of it.
//
// Mounted once at the layout root, like DirectMessagesHost and for the same
// reason squared: a call arrives whenever it arrives, and it has to be
// answerable from wherever the person happens to be — the home page, a room,
// the friends list. A ring that only appeared on one page would be a phone
// that only rings while you are looking at it.
//
// What it deliberately does *not* do is any calling. Answering is one request;
// everything after it is an ordinary private room (see the API's callStore),
// so this component's whole job ends at router.push. There is no media here,
// no peer connection, nothing to tear down — which is why "the call dropped
// but the room stayed up" cannot happen.

/** How the ring is announced on a device that is open but not being watched. */
const CALL_NOTIFICATION_TAG = "call";

/**
 * What to say about a call that stopped ringing.
 *
 * Only two of the four reasons say anything. A "cancelled" is the caller's own
 * doing and a "declined" is the callee's, so each of them is told nothing they
 * did not just do — what is left is the caller learning their call was refused,
 * and the caller learning nobody picked up.
 */
function noticeFor(reason: string | null): string | null {
  if (reason === "declined") return "Chamada recusada.";
  if (reason === "timeout") return "Ninguém atendeu.";
  return null;
}

export function CallHost() {
  const { account } = useAuth();
  const router = useRouter();
  const {
    incomingCall,
    outgoingCall,
    callAccepted,
    callAcceptedSeq,
    callEnded,
    callEndedSeq,
  } = useSignaling();
  const [busy, setBusy] = useState(false);

  // ─── The passing remark under the ring ──────────────────────────────────
  //
  // "Chamada recusada", "ninguém atendeu" — a sentence about a call that just
  // stopped, shown for a few seconds and then gone.
  //
  // Derived while rendering rather than assigned from an effect, which is
  // React's own answer for state that is a function of something that
  // arrived: the two counters are what say "this is a *new* event and not the
  // one already on screen", so comparing them here is the whole computation.
  // Doing it in an effect would render once with the stale sentence and then
  // again with the right one, which for a banner that appears for four
  // seconds is a visible flash of the previous call's outcome.
  const [notice, setNotice] = useState<{
    endedSeq: number;
    acceptedSeq: number;
    text: string | null;
  }>({ endedSeq: 0, acceptedSeq: 0, text: null });

  if (notice.endedSeq !== callEndedSeq || notice.acceptedSeq !== callAcceptedSeq) {
    setNotice({
      endedSeq: callEndedSeq,
      acceptedSeq: callAcceptedSeq,
      // A call that was *answered* leaves nothing to say — both people are on
      // their way into the room — and it must also clear whatever the
      // previous call left behind, or "chamada recusada" follows somebody
      // into a call that is starting perfectly well.
      text:
        notice.acceptedSeq !== callAcceptedSeq ? null : noticeFor(callEnded?.reason ?? null),
    });
  }
  const noticeText = notice.text;

  // ─── Cold start ─────────────────────────────────────────────────────────
  //
  // The half that makes "with the app closed" mean anything: a notification is
  // tapped, the app starts with no socket and nothing on screen, and this asks
  // the API what is still ringing. Also covers the ordinary case of a socket
  // that reconnected across the ring — the live message went to a connection
  // that no longer exists, and only this finds the call again.
  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    void (async () => {
      const pending = await fetchPendingCalls(controller.signal);
      if (!pending) return;
      signalingClient.adoptCalls(pending.incoming[0] ?? null, pending.outgoing[0] ?? null);
    })();
    return () => controller.abort();
  }, [account]);

  // Re-asked whenever the app comes back to the front. A phone that was in a
  // pocket for the whole ring has a socket that heard everything and a page
  // that heard none of it.
  useEffect(() => {
    if (!account) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void fetchPendingCalls().then((pending) => {
        if (!pending) return;
        signalingClient.adoptCalls(pending.incoming[0] ?? null, pending.outgoing[0] ?? null);
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [account]);

  // ─── Ringing ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (incomingCall) startRingtone("incoming");
    else if (outgoingCall) startRingtone("outgoing");
    else stopRingtone();

    // And the desktop shell, whose window may be sitting in the tray with
    // nothing on screen at all — see electron/main.ts's setCallRinging. Only
    // for an *incoming* call: the person placing one is looking at the app by
    // definition, and a window that flashes at somebody who just pressed
    // "ligar" is flashing at them about their own action.
    getDesktopBridge()?.setCallRinging?.(Boolean(incomingCall));

    // Not only on unmount: this component never unmounts, so the cleanup that
    // matters is the one that runs when the call it was ringing for is gone.
    return () => {
      stopRingtone();
      getDesktopBridge()?.setCallRinging?.(false);
    };
  }, [incomingCall, outgoingCall]);

  // A device that is open but behind something else still deserves a system
  // notification — the push was skipped precisely *because* this device is
  // online (see the API's isAccountDeviceOnline), so this is the alert that
  // stands in for it. showNotification stays quiet when the page is focused,
  // which is exactly when the screen below is already on top of everything.
  const announcedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!incomingCall) return;
    if (announcedRef.current === incomingCall.id) return;
    announcedRef.current = incomingCall.id;
    void showNotification({
      title: `${incomingCall.from.displayName} está te ligando`,
      body: "Toque para atender.",
      tag: CALL_NOTIFICATION_TAG,
      icon: incomingCall.from.avatarUrl ?? undefined,
      requireInteraction: true,
      // A ring is the one alert in this app that outranks the local mute: a
      // person who silenced chat notifications did not thereby say they never
      // want to know somebody is calling them.
      ignoreMutePreference: true,
      onClick: () => window.focus(),
    });
  }, [incomingCall]);

  // ─── Walking into the room ──────────────────────────────────────────────
  //
  // Both sides receive "call-accepted", so both sides run this — which is what
  // makes "we end up in the same room" one message rather than a negotiation.
  const lastAcceptedRef = useRef(0);
  useEffect(() => {
    if (callAcceptedSeq === lastAcceptedRef.current) return;
    lastAcceptedRef.current = callAcceptedSeq;
    if (!callAccepted) return;
    stopRingtone();
    router.push(`/watch/${callAccepted.roomHandle}`);
  }, [callAccepted, callAcceptedSeq, router]);

  // A notice is a passing remark, not a state: it takes itself down so there
  // is never a stale "ninguém atendeu" sitting over the next call. The
  // setState is inside the timer rather than in the effect body, which is
  // both what the rule wants and what this actually means — the change
  // happens four seconds later, not now.
  useEffect(() => {
    if (!noticeText) return;
    const timer = setTimeout(
      () => setNotice((current) => ({ ...current, text: null })),
      4000
    );
    return () => clearTimeout(timer);
  }, [noticeText]);

  const onAccept = useCallback(async () => {
    if (!incomingCall || busy) return;
    setBusy(true);
    stopRingtone();
    const result = await acceptCall(incomingCall.id);
    setBusy(false);
    if (!result.ok) {
      // Taken off screen either way: whatever the reason, this call is not
      // ringing any more, and leaving the buttons up would offer to answer
      // something that no longer exists.
      signalingClient.clearCall(incomingCall.id);
      setNotice((current) => ({ ...current, text: result.error }));
      return;
    }
    signalingClient.clearCall(incomingCall.id);
    // Navigated here as well as from the socket message above: on a cold start
    // the socket may not even be connected yet, and the person who pressed
    // "atender" must not be left looking at a button that did nothing.
    router.push(`/watch/${result.roomHandle}`);
  }, [busy, incomingCall, router]);

  const onDecline = useCallback(() => {
    if (!incomingCall) return;
    stopRingtone();
    signalingClient.clearCall(incomingCall.id);
    endCall(incomingCall.id, "decline");
  }, [incomingCall]);

  const onCancel = useCallback(() => {
    if (!outgoingCall) return;
    stopRingtone();
    signalingClient.clearCall(outgoingCall.id);
    endCall(outgoingCall.id, "cancel");
  }, [outgoingCall]);

  if (!account) return null;

  // Incoming wins over outgoing when somehow both exist: being asked something
  // outranks waiting for an answer.
  const call = incomingCall ?? outgoingCall;
  if (!call && !noticeText) return null;

  const isIncoming = Boolean(incomingCall);
  const other = isIncoming ? call!.from : call!.to;

  return (
    <div
      // Above every dialog in the app, including the room's own: a call is the
      // one thing that may interrupt anything.
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-3 sm:pt-5"
      role="alert"
      aria-live="assertive"
    >
      {call ? (
        <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-3 p-4">
            <UserAvatar
              src={other.avatarUrl}
              name={other.displayName}
              size={48}
              // Only the incoming ring pulses. The caller's own screen is a
              // status, not a summons.
              className={isIncoming ? "animate-pulse" : ""}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                {other.displayName}
              </p>
              <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                {isIncoming ? "está te ligando…" : "chamando…"}
              </p>
            </div>
          </div>

          <div className="flex gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
            {isIncoming ? (
              <>
                <button
                  type="button"
                  onClick={onDecline}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 font-medium text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <MdCallEnd className="h-5 w-5" />
                  Recusar
                </button>
                <button
                  type="button"
                  onClick={onAccept}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MdCall className="h-5 w-5" />
                  Atender
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onCancel}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-medium text-white transition hover:bg-red-500"
              >
                <MdCallEnd className="h-5 w-5" />
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="pointer-events-auto rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {noticeText}
        </div>
      )}
    </div>
  );
}

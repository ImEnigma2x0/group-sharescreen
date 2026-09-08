// Bridge for the small ringing window (see call-overlay.html).
//
// Its own preload for the same reason the picker has one: it is a different
// window with a different job, and the surface it may reach is exactly two
// calls — "what am I showing" and "this is what was pressed".
//
// Note what is deliberately absent: any way to reach the account, the API or
// the socket. This window has no session and is not given one. It reports a
// button press to main, which hands it to the page that has been holding the
// connection all along — so the shell never ends up with a second copy of the
// sign-in state, and a bug in this window cannot answer a call by itself.

import { contextBridge, ipcRenderer } from "electron";
import { IPC, type CallOverlayChoice, type CallOverlayData } from "./channels";

contextBridge.exposeInMainWorld("callOverlay", {
  data(): Promise<CallOverlayData | null> {
    return ipcRenderer.invoke(IPC.callOverlayData);
  },
  /**
   * Subscribes to "it is somebody else now". Returns an unsubscribe function,
   * like the main preload's own listeners.
   */
  onUpdate(callback: (data: CallOverlayData) => void): () => void {
    const listener = (_event: unknown, data: unknown) => {
      if (data && typeof data === "object") callback(data as CallOverlayData);
    };
    ipcRenderer.on(IPC.callOverlayUpdate, listener);
    return () => {
      ipcRenderer.off(IPC.callOverlayUpdate, listener);
    };
  },

  choose(choice: CallOverlayChoice): void {
    // Rebuilt rather than forwarded, so what crosses the boundary is the two
    // fields this contract has and nothing the page happened to attach.
    ipcRenderer.send(IPC.callOverlayChoose, {
      action: choice.action === "accept" ? "accept" : "decline",
      ...(typeof choice.reason === "string" && choice.reason.trim()
        ? { reason: choice.reason.trim().slice(0, 500) }
        : {}),
    });
  },
});

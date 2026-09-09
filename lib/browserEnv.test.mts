import test from "node:test";
import assert from "node:assert/strict";
import { isObsClient } from "./browserEnv";
import { isObsPeer } from "./signalingClient";

test("isObsClient: detecta OBS via window.obsstudio", () => {
  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  try {
    (globalThis as unknown as { window: unknown }).window = {
      obsstudio: {},
    };
    assert.equal(isObsClient(), true);
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
  }
});

test("isObsClient: detecta OBS via User-Agent", () => {
  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  try {
    (globalThis as unknown as { window: unknown }).window = {
      navigator: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 OBS/30.0.2",
      },
    };
    assert.equal(isObsClient(), true);
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
  }
});

test("isObsClient: detecta rota /stream e /obs", () => {
  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  try {
    (globalThis as unknown as { window: unknown }).window = {
      location: {
        pathname: "/stream/minha-sala/screen/user-1",
        search: "",
      },
    };
    assert.equal(isObsClient(), true);

    (globalThis as unknown as { window: unknown }).window = {
      location: {
        pathname: "/obs/minha-sala/screen/user-1",
        search: "",
      },
    };
    assert.equal(isObsClient(), true);
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
  }
});

test("isBroadcastSoftware: retorna true apenas para software de transmissão e false para navegadores", async () => {
  const { isBroadcastSoftware } = await import("./browserEnv");
  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  try {
    // Normal browser on /stream route -> false
    (globalThis as unknown as { window: unknown }).window = {
      navigator: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
      },
      location: {
        pathname: "/stream/minha-sala/screen/user-1",
        search: "",
      },
    };
    assert.equal(isBroadcastSoftware(), false);

    // OBS Studio embedded browser -> true
    (globalThis as unknown as { window: unknown }).window = {
      obsstudio: {},
      navigator: { userAgent: "Mozilla/5.0 Chrome/120.0.0.0" },
    };
    assert.equal(isBroadcastSoftware(), true);
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
  }
});

test("isObsPeer: não considera nomes como 'obs-123' como OBS, apenas role === 'obs'", () => {
  assert.equal(isObsPeer({ name: "obs-123" }), false);
  assert.equal(isObsPeer({ name: "OBS-Fulano" }), false);
  assert.equal(isObsPeer({ name: "Stream-1234" }), false);
  assert.equal(isObsPeer({ name: "Viewer-1" }), false);
  assert.equal(isObsPeer({ name: "Fonte" }), false);
  assert.equal(isObsPeer({ name: "Captura de Tela" }), false);

  // Apenas conexões com role === "obs" são identificadas como OBS
  assert.equal(isObsPeer({ role: "obs", name: "Stream-1234" }), true);
  assert.equal(isObsPeer({ role: "obs" }), true);
  assert.equal(isObsPeer({ role: "moderator" }), false);
  assert.equal(isObsPeer(null), false);
});

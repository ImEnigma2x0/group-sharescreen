// node --experimental-strip-types lib/profileTheme.test.mts
//
// The light/dark decision is the part worth pinning: it is invisible when
// right and unreadable when wrong, and the tempting shortcut (average the
// three channels) fails on exactly the colours people pick for a profile.

import assert from "node:assert/strict";
import { luminance, profileThemeStyle, isHexColor } from "./profileTheme";

const style = (from: string, to: string) => profileThemeStyle({ from, to, angle: 180 })!;

// The two extremes, which anything must get right.
assert.equal(style("#000000", "#000000").text, "#ffffff", "preto pede texto branco");
assert.equal(style("#ffffff", "#ffffff").text, "#18181b", "branco pede texto escuro");

// Pure blue is the case a channel average gets wrong: (0+0+255)/3 reads as a
// mid-tone, while the eye sees it as dark.
assert.ok(luminance("#0000ff") < 0.1, "azul puro é escuro para a vista");
assert.equal(style("#0000ff", "#1d4ed8").text, "#ffffff");

// Pure yellow is the mirror image: bright to the eye, and a naive average
// would call it mid-tone too.
assert.ok(luminance("#ffff00") > 0.8, "amarelo puro é claro");
assert.equal(style("#ffff00", "#fde047").text, "#18181b");

// Green weighs most, blue least — the reason the weights exist at all.
assert.ok(luminance("#00ff00") > luminance("#ff0000"));
assert.ok(luminance("#ff0000") > luminance("#0000ff"));

// A gradient with one dark and one light end still has to pick one answer for
// the whole surface, since text cannot change colour halfway across a word.
const mixed = style("#000000", "#ffffff");
assert.ok(mixed.text === "#ffffff" || mixed.text === "#18181b");
assert.ok(mixed.border.startsWith("rgba("), "a borda vem da mesma paleta");

// Shorthand hex is accepted and means the same as its long form.
assert.equal(luminance("#fff"), luminance("#ffffff"));
assert.equal(style("#000", "#000").text, style("#000000", "#000000").text);

// The direction reaches the CSS, and the colours with it.
assert.match(
  profileThemeStyle({ from: "#123456", to: "#abcdef", angle: 45 })!.background,
  /^linear-gradient\(45deg, #123456 0%, #abcdef 100%\)$/
);

// Anything unusable renders as no theme at all, never as broken CSS.
assert.equal(profileThemeStyle(null), null);
assert.equal(profileThemeStyle({ from: "red", to: "#fff", angle: 0 }), null);
assert.equal(isHexColor("#ff00ff"), true);
assert.equal(isHexColor("javascript:alert(1)"), false);

// Contrast tiers: the quiet lines must stay clearly above nothing, and the
// mid-tone shadow must appear only where it is needed.
{
  const dark = style("#000000", "#111111");
  assert.ok(dark.muted.startsWith("rgba(255,255,255,"), "fundo escuro pede texto claro em todos os niveis");
  assert.ok(dark.faint.startsWith("rgba(255,255,255,"));
  // The footnote is the quietest line, never the loudest.
  const alphaOf = (rgba: string) => Number(rgba.slice(0, -1).split(",")[3]);
  assert.ok(alphaOf(dark.faint) < alphaOf(dark.muted), "o rodape e o mais discreto");
  assert.ok(alphaOf(dark.border) < alphaOf(dark.faint), "a borda e mais discreta que o texto");
  // Black and white are unambiguous — no shadow needed.
  assert.equal(dark.textShadow, undefined);
  assert.equal(style("#ffffff", "#ffffff").textShadow, undefined);
}

// A mid-tone background is where neither text colour is comfortable, and the
// shadow is what carries the letters there.
{
  const mid = style("#7f8c8d", "#95a5a6");
  assert.ok(mid.textShadow, "tom medio precisa de sombra");
}

console.log("profileTheme: ok");

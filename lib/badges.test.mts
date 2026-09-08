// node --experimental-strip-types lib/badges.test.mts
import assert from "node:assert/strict";
import {
  getUserBadges,
  useBadgesCatalog,
  fetchBadgesCatalog,
  DEFAULT_BADGES,
  BADGE_DEFINITIONS,
  BETA_TESTER_CUTOFF_MS,
  type BadgeDefinition,
} from "./badges";

// 1. Exports verification
assert.ok(typeof useBadgesCatalog === "function", "useBadgesCatalog must be exported as a function");
assert.ok(typeof fetchBadgesCatalog === "function", "fetchBadgesCatalog must be exported as a function");
assert.ok(Array.isArray(DEFAULT_BADGES), "DEFAULT_BADGES must be an array");
assert.ok(typeof BADGE_DEFINITIONS === "object", "BADGE_DEFINITIONS must be an object");

// 2. A badge is earned, never granted by who you say you are.
//
// This used to assert the opposite: there was a testing override in
// getUserBadges handing every badge to whoever called themselves "sasdasd",
// and this file checked for it. The override is gone, and these assertions
// exist so it cannot come back by accident — a username is not a credential,
// and one that unlocked every badge would unlock the staff one too.
for (const username of ["sasdasd", "@sasdasd", "SasDasd", "staff", "admin"]) {
  assert.equal(
    getUserBadges({ username }).length,
    0,
    `@${username} earns nothing from the username alone`
  );
}

// 3. Flag-based badge assignment
const staffBadges = getUserBadges({ username: "staff_user", flags: ["STAFF"] });
assert.ok(staffBadges.some((b) => b.id === "staff"), "User with STAFF flag should receive staff badge");

const bugHunterBadges = getUserBadges({ username: "hunter", flags: ["BUG_HUNTER"] });
assert.ok(bugHunterBadges.some((b) => b.id === "bug_hunter"), "User with BUG_HUNTER flag should receive bug hunter badge");

// Note the spelling: the flag really is CONTRIBUITOR, and it is what the
// badge's requiredFlag matches on. Asserted with the exact string rather than
// with a friendlier one so that renaming the flag has to come here first.
const contributorBadges = getUserBadges({ username: "dev", flags: ["CONTRIBUITOR"] });
assert.ok(contributorBadges.some((b) => b.id === "contributor"), "User with CONTRIBUITOR flag should receive contributor badge");

const mobileBetaBadges = getUserBadges({ username: "mobile_user", flags: ["BETA_MOBILE"] });
assert.ok(mobileBetaBadges.some((b) => b.id === "beta_mobile"), "User with BETA_MOBILE flag should receive mobile beta badge");

// 4. Pro badge assignment (not a flag, via premium or feature or PRO flag)
const proFlagBadges = getUserBadges({ username: "pro_user", flags: ["PRO"] });
assert.ok(proFlagBadges.some((b) => b.id === "pro"), "User with PRO flag should receive pro badge");

const proPremiumBadges = getUserBadges({ username: "premium_user", premium: { active: true } });
assert.ok(proPremiumBadges.some((b) => b.id === "pro"), "User with premium object should receive pro badge");

const proFeatureBadges = getUserBadges({ username: "feature_user", features: ["verified_badge"] });
assert.ok(proFeatureBadges.some((b) => b.id === "pro"), "User with verified_badge feature should receive pro badge");

// 5. Beta Tester is a flag, not a date this file works out for itself.
//
// It used to be computed here from the account's createdAt. That moved to the
// API's auto-flag rules (see its autoFlagStore.ts), which write BETA_TESTER
// onto the account — deliberately, because "you were here early" is a fact
// about the past that has to survive the rule being switched off, and a client
// recomputing it would drop the badge the day the cutoff was edited.
const betaTesterBadges = getUserBadges({ username: "early", flags: ["BETA_TESTER"] });
assert.ok(betaTesterBadges.some((b) => b.id === "beta_tester"), "Account with the BETA_TESTER flag receives the badge");

const earlyAccountBadges = getUserBadges({
  username: "early_adopter",
  createdAt: BETA_TESTER_CUTOFF_MS - 1000,
});
assert.ok(
  !earlyAccountBadges.some((b) => b.id === "beta_tester"),
  "An early createdAt alone grants nothing — the API decides, and it says so with the flag"
);

const lateAccountBadges = getUserBadges({
  username: "late_adopter",
  createdAt: BETA_TESTER_CUTOFF_MS + 1000,
});
assert.ok(!lateAccountBadges.some((b) => b.id === "beta_tester"), "Account created after cutoff does not receive beta tester badge");

// 6. Custom database-driven badges
const customCatalog: BadgeDefinition[] = [
  ...DEFAULT_BADGES,
  {
    id: "vip_donor",
    name: "VIP Donor",
    flagTag: "VIP_DONOR",
    description: "Apoiador VIP do projeto",
    iconUrl: "https://example.com/vip.svg",
    requiredFlag: "VIP_DONOR",
    createdAt: 1725753600000,
  },
];

const vipUserBadges = getUserBadges({ username: "vip_user", flags: ["VIP_DONOR"] }, false, customCatalog);
assert.ok(vipUserBadges.some((b) => b.id === "vip_donor"), "User with custom VIP_DONOR flag receives custom badge");

// A catalog from the database replaces the built-in one rather than adding to
// it, so a badge that was removed there stops being granted here.
const vipOnlyCatalog = customCatalog.filter((badge) => badge.id === "vip_donor");
const staffAgainstVipOnly = getUserBadges({ username: "staff_user", flags: ["STAFF"] }, false, vipOnlyCatalog);
assert.equal(staffAgainstVipOnly.length, 0, "A badge absent from the catalog is not granted");

// An empty catalog is "the fetch has not landed yet", not "nobody has any
// badges" — falling back to the defaults is what keeps a profile from
// flickering blank on load.
const staffAgainstEmpty = getUserBadges({ username: "staff_user", flags: ["STAFF"] }, false, []);
assert.ok(staffAgainstEmpty.some((b) => b.id === "staff"), "An empty catalog falls back to the defaults");

console.log("badges: ok");

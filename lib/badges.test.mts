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

// 2. Local test user @sasdasd receives all badges
const sasdasdBadges = getUserBadges({ username: "sasdasd" });
assert.equal(sasdasdBadges.length, DEFAULT_BADGES.length, "@sasdasd should receive all default badges");

const sasdasdWithAtBadges = getUserBadges({ username: "@sasdasd" });
assert.equal(sasdasdWithAtBadges.length, DEFAULT_BADGES.length, "@sasdasd (with @) should receive all default badges");

// 3. Flag-based badge assignment
const staffBadges = getUserBadges({ username: "staff_user", flags: ["STAFF"] });
assert.ok(staffBadges.some((b) => b.id === "staff"), "User with STAFF flag should receive staff badge");

const bugHunterBadges = getUserBadges({ username: "hunter", flags: ["BUG_HUNTER"] });
assert.ok(bugHunterBadges.some((b) => b.id === "bug_hunter"), "User with BUG_HUNTER flag should receive bug hunter badge");

const contributorBadges = getUserBadges({ username: "dev", flags: ["CONTRIBUITOR"] });
assert.ok(contributorBadges.some((b) => b.id === "contributor"), "User with CONTRIBUITOR flag should receive contributor badge");

const contributorAliasBadges = getUserBadges({ username: "dev2", flags: ["CONTRIBUTOR"] });
assert.ok(contributorAliasBadges.some((b) => b.id === "contributor"), "User with CONTRIBUTOR flag should receive contributor badge");

const mobileBetaBadges = getUserBadges({ username: "mobile_user", flags: ["BETA_MOBILE"] });
assert.ok(mobileBetaBadges.some((b) => b.id === "beta_mobile"), "User with BETA_MOBILE flag should receive mobile beta badge");

// 4. Pro badge assignment (not a flag, via premium or feature or PRO flag)
const proFlagBadges = getUserBadges({ username: "pro_user", flags: ["PRO"] });
assert.ok(proFlagBadges.some((b) => b.id === "pro"), "User with PRO flag should receive pro badge");

const proPremiumBadges = getUserBadges({ username: "premium_user", premium: { active: true } });
assert.ok(proPremiumBadges.some((b) => b.id === "pro"), "User with premium object should receive pro badge");

const proFeatureBadges = getUserBadges({ username: "feature_user", features: ["verified_badge"] });
assert.ok(proFeatureBadges.some((b) => b.id === "pro"), "User with verified_badge feature should receive pro badge");

// 5. Beta tester badge (early account created before 10/09/2026)
const earlyAccountBadges = getUserBadges({
  username: "early_adopter",
  createdAt: BETA_TESTER_CUTOFF_MS - 1000,
});
assert.ok(earlyAccountBadges.some((b) => b.id === "beta_tester"), "Account created before cutoff receives beta tester badge");

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

// @sasdasd receives all custom badges too
const sasdasdCustomBadges = getUserBadges({ username: "sasdasd" }, false, customCatalog);
assert.equal(sasdasdCustomBadges.length, customCatalog.length, "@sasdasd receives all badges in custom catalog");

console.log("badges: ok");


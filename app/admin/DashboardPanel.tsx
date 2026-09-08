"use client";

import { StatsOverview } from "./StatsOverview";
import { AnnouncementPanel } from "./AnnouncementPanel";
import { PartnerAdsPanel } from "./PartnerAdsPanel";
import { AdsterraPanel } from "./AdsterraPanel";
import { GrantPremiumPanel } from "./GrantPremiumPanel";
import { AccountFlagsPanel } from "./AccountFlagsPanel";
import { AccountPointsPanel } from "./AccountPointsPanel";
import { AntiSpamPanel } from "./AntiSpamPanel";
import { BannedWordsPanel } from "./BannedWordsPanel";
import { BansPanel } from "./BansPanel";
import { SupportersPanel } from "./SupportersPanel";
import { DesktopUpdatePanel } from "./DesktopUpdatePanel";
import { EvalPanel } from "./EvalPanel";

export function DashboardPanel() {
  return (
    <div className="flex flex-col gap-6">
      <StatsOverview />
      <AnnouncementPanel />
      <PartnerAdsPanel />
      <AdsterraPanel />
      <GrantPremiumPanel />
      <AccountFlagsPanel />
      <AccountPointsPanel />
      <SupportersPanel />
      <DesktopUpdatePanel />
      <AntiSpamPanel />
      <BannedWordsPanel />
      <BansPanel />
      <EvalPanel />
    </div>
  );
}

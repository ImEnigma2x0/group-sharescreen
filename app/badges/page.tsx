import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { BadgesPanel } from "./BadgesPanel";

const TITLE = "Badges do GoLive — o que cada uma significa";
const DESCRIPTION =
  "Todas as badges do GoLive e como cada uma é conquistada: staff, bug hunter, contribuidor, beta tester, apoiador inicial e as que vêm com o plano Pro.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["badges golive", "selos golive", "bug hunter", "beta tester", "apoiador inicial"],
  alternates: { canonical: "/badges" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/badges",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Deliberately no badge list in this file. The catalogue is a database
// collection (see the API's /badges), and a copy here would be a second
// source of truth that goes stale the day somebody adds one — the panel
// reads the live one.
export default function BadgesPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50 dark:bg-black">
      <SiteHeader />
      <BadgesPanel />
    </div>
  );
}

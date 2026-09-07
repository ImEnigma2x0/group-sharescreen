"use client";

import { Tooltip } from "./Tooltip";
import { getUserBadges, useBadgesCatalog, type BadgeDefinition } from "@/lib/badges";
import type { Account } from "@/lib/accountApi";

interface UserBadgesProps {
  account: Pick<Account, "id" | "username" | "flags" | "createdAt" | "premium" | "features">;
  isOwner?: boolean;
  className?: string;
}

export function UserBadges({ account, isOwner, className }: UserBadgesProps) {
  const catalog = useBadgesCatalog();
  const badges = getUserBadges(account, isOwner, catalog);
  if (badges.length === 0) return null;

  return (
    <div className={`inline-flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      {badges.map((badge) => (
        <BadgeItem key={badge.id} badge={badge} />
      ))}
    </div>
  );
}

function BadgeItem({ badge }: { badge: BadgeDefinition }) {
  const tooltipContent = (
    <div className="flex flex-col gap-1 p-1 max-w-[220px] text-left">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center p-1 rounded-md border ${badge.bgClass ?? "bg-zinc-800/40"} ${badge.borderClass ?? "border-zinc-700/50"}`}
        >
          <img
            src={badge.iconUrl}
            alt={badge.name}
            className="h-full w-full object-contain pointer-events-none select-none"
            loading="lazy"
          />
        </span>
        <div className="min-w-0">
          <span className="text-xs font-semibold text-zinc-100 truncate block">{badge.name}</span>
        </div>
      </div>
      <p className="text-[11px] leading-snug text-zinc-300">
        {badge.description}
      </p>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} placement="top" delay={[150, 0]}>
      <button
        type="button"
        aria-label={`${badge.name}: ${badge.description}`}
        className={`inline-flex h-5 w-5 items-center justify-center p-0.5 rounded-md border transition-all duration-150 hover:scale-110 active:scale-95 cursor-pointer overflow-hidden ${badge.chipClass ?? "border-zinc-700/40 bg-zinc-800/20"}`}
      >
        <img
          src={badge.iconUrl}
          alt={badge.name}
          className="h-3.5 w-3.5 object-contain pointer-events-none select-none"
          loading="lazy"
        />
      </button>
    </Tooltip>
  );
}

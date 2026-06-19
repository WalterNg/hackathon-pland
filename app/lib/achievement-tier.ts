export type AchievementTier = "bronze" | "silver" | "gold";

// tier number from DB: 1 = bronze, 2 = silver, 3 = gold
export function getTierFromNumber(tier: number): AchievementTier | null {
  if (tier === 1) return "bronze";
  if (tier === 2) return "silver";
  if (tier === 3) return "gold";
  return null;
}

const IMAGE_FOLDER_CID = "bafybeih64xr5ymvnjb6c2pbvohldvit22d2snufeojizeexbch4gutxsii";

export function badgeImageUrl(achievementKey: string) {
  return `https://gateway.pinata.cloud/ipfs/${IMAGE_FOLDER_CID}/${achievementKey}.png`;
}

export const TIER_STYLES = {
  bronze: {
    gradientFrom: "from-[#79472e]",
    pill: "bg-amber-500/15 text-amber-400",
    dot: "bg-amber-500",
    ring: "ring-amber-500/40",
    glow: "shadow-[0_0_20px_0_rgba(245,158,11,0.3)]",
  },
  silver: {
    gradientFrom: "from-[#75727d]",
    pill: "bg-slate-400/15 text-slate-300",
    dot: "bg-slate-400",
    ring: "ring-slate-400/40",
    glow: "shadow-[0_0_20px_0_rgba(148,163,184,0.3)]",
  },
  gold: {
    gradientFrom: "from-[#2d2000]",
    pill: "bg-yellow-400/15 text-yellow-300",
    dot: "bg-yellow-400",
    ring: "ring-yellow-400/40",
    glow: "shadow-[0_0_20px_0_rgba(250,204,21,0.35)]",
  },
} satisfies Record<AchievementTier, object>;

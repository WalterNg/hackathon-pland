export type AchievementTier = "bronze" | "silver" | "gold";

// tier number from DB: 1 = bronze, 2 = silver, 3 = gold
export function getTierFromNumber(tier: number): AchievementTier | null {
  if (tier === 1) return "bronze";
  if (tier === 2) return "silver";
  if (tier === 3) return "gold";
  return null;
}

const IMAGE_FOLDER_CID = "bafybeih64xr5ymvnjb6c2pbvohldvit22d2snufeojizeexbch4gutxsii";
const MANUAL_CERT_IMAGE_URL =
  "https://gateway.pinata.cloud/ipfs/bafybeidodyb5k4w3pxmdzt6u3mbk6m4puns6opp5epd5pikpfbiko3hiwe";

export function badgeImageUrl(achievementKey: string | null): string {
  if (!achievementKey) return MANUAL_CERT_IMAGE_URL;
  return `https://gateway.pinata.cloud/ipfs/${IMAGE_FOLDER_CID}/${achievementKey}.png`;
}

export const TIER_STYLES = {
  bronze: {
    gradientFrom: "from-[#79472e]",
    dot: "bg-amber-500",
    ring: "ring-amber-500/40",
    glow: "shadow-[0_0_20px_0_rgba(245,158,11,0.3)]",
  },
  silver: {
    gradientFrom: "from-[#75727d]",
    dot: "bg-slate-400",
    ring: "ring-slate-400/40",
    glow: "shadow-[0_0_20px_0_rgba(148,163,184,0.3)]",
  },
  gold: {
    gradientFrom: "from-[#f4a036]",
    dot: "bg-yellow-400",
    ring: "ring-yellow-400/40",
    glow: "shadow-[0_0_20px_0_rgba(250,204,21,0.35)]",
  },
} satisfies Record<AchievementTier, object>;

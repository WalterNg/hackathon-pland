"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChainNft = {
  certificateId: string;
  title: string;
  achievementKey: string | null;
  snapshotAt: string;
  snapshotHash: string;
  nftTokenId: number | null;
  nftTxHash: string | null;
  tokenUri: string | null;
  onChainHash: string | null;
  hashVerified: boolean | null;
  etherscanUrl: string | null;
};

type MilestoneEntry = {
  badge: string;
  date: string;
  criterion: string;
  onChainProof: string;
  hashVerified: boolean | null;
};

type AuditReport = {
  summary: string;
  milestones: MilestoneEntry[];
  overallAssessment: string;
  caveats: string[];
};

type StoryMode = "share" | "audit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithAuth(path: string, init: RequestInit = {}) {
  const supabase = await createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return fetch(path, { ...init, headers, cache: "no-store" });
}

function HashBadge({ verified }: { verified: boolean | null }) {
  if (verified === true) return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.6rem] font-bold text-emerald-400">✓ verified</span>;
  if (verified === false) return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[0.6rem] font-bold text-red-400">✗ mismatch</span>;
  return <span className="rounded-full bg-white/8 px-2 py-0.5 text-[0.6rem] font-bold text-neutral-500">—</span>;
}

// ---------------------------------------------------------------------------
// Storytelling Modal
// ---------------------------------------------------------------------------

type Props = {
  onClose: () => void;
};

export function StorytellingModal({ onClose }: Props) {
  const [mode, setMode] = useState<StoryMode>("share");
  const [nfts, setNfts] = useState<ChainNft[] | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadNfts() {
    setIsLoadingNfts(true);
    setError(null);
    setNfts(null);
    setNarrative(null);
    setAuditReport(null);

    try {
      const res = await fetchWithAuth("/api/storytelling/nfts");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail ?? "Failed to load NFTs from chain.");
      setNfts((data as { nfts: ChainNft[] }).nfts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load NFTs.");
    } finally {
      setIsLoadingNfts(false);
    }
  }

  async function generateStory() {
    if (!nfts) return;
    setIsGenerating(true);
    setError(null);
    setNarrative(null);
    setAuditReport(null);

    try {
      const res = await fetchWithAuth("/api/storytelling/generate", {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail ?? "Story generation failed.");

      if (mode === "share") {
        setNarrative((data as { narrative: string }).narrative ?? "");
      } else {
        setAuditReport((data as { report: AuditReport }).report ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Story generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyNarrative() {
    if (!narrative) return;
    await navigator.clipboard.writeText(narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasResult = narrative !== null || auditReport !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-2xl flex-col rounded-3xl bg-(--surface-container-high) shadow-2xl ring-1 ring-white/10 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-neutral-500">AI Storytelling</p>
            <h2 className="mt-1.5 text-xl font-bold text-white">Get My Story</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Generate your investment narrative from on-chain verified achievements.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          {/* Step 1: Read from chain */}
          {!nfts && (
            <div className="rounded-2xl border border-white/8 bg-(--surface-container-low) p-5 text-center">
              <div className="mb-3 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15">
                  <svg className="h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-semibold text-neutral-300">Step 1: Read your NFTs from chain</p>
              <p className="mt-1 text-xs text-neutral-500">
                We&apos;ll fetch your badge list from Ethereum Sepolia and verify each snapshot hash.
              </p>
              <button
                type="button"
                onClick={loadNfts}
                disabled={isLoadingNfts}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              >
                {isLoadingNfts ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Reading from chain…
                  </>
                ) : "Read from blockchain"}
              </button>
            </div>
          )}

          {/* NFT list + Step 2: generate */}
          {nfts && (
            <>
              {/* On-chain NFT list */}
              <div className="rounded-2xl border border-white/8 bg-(--surface-container-low) p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[0.6rem] font-bold uppercase tracking-widest text-neutral-500">
                    On-chain badges ({nfts.length})
                  </p>
                  <button
                    type="button"
                    onClick={loadNfts}
                    disabled={isLoadingNfts}
                    className="text-[0.65rem] font-semibold text-neutral-500 hover:text-white transition-colors"
                  >
                    {isLoadingNfts ? "Refreshing…" : "Refresh"}
                  </button>
                </div>

                {nfts.length === 0 ? (
                  <p className="text-sm text-neutral-500">No minted NFT badges found yet.</p>
                ) : (
                  <div className="space-y-2">
                    {nfts.map((nft) => (
                      <div key={nft.certificateId} className="flex items-center justify-between gap-3 rounded-xl bg-white/3 px-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{nft.title}</p>
                          <p className="text-xs text-neutral-500">
                            Token #{nft.nftTokenId} · {(nft.snapshotAt || "").slice(0, 10)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <HashBadge verified={nft.hashVerified} />
                          {nft.etherscanUrl && (
                            <a
                              href={nft.etherscanUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-neutral-600 hover:text-neutral-300 transition-colors"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 2: Mode picker + Generate */}
              {nfts.length > 0 && (
                <div className="rounded-2xl border border-white/8 bg-(--surface-container-low) p-4">
                  <p className="mb-3 text-[0.6rem] font-bold uppercase tracking-widest text-neutral-500">
                    Step 2: Choose output mode
                  </p>
                  <div className="flex gap-2 mb-4">
                    {(["share", "audit"] as StoryMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setMode(m); setNarrative(null); setAuditReport(null); }}
                        className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${mode === m ? "bg-violet-600 text-white" : "border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5"}`}
                      >
                        {m === "share" ? "📢 Share" : "🔍 Audit"}
                      </button>
                    ))}
                  </div>
                  <p className="mb-4 text-xs text-neutral-500">
                    {mode === "share"
                      ? "A conversational narrative of your journey — perfect for social media."
                      : "A structured due-diligence report with on-chain references."}
                  </p>
                  <button
                    type="button"
                    onClick={generateStory}
                    disabled={isGenerating}
                    className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating…
                      </span>
                    ) : "Generate my story"}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Share narrative result */}
          {narrative && (
            <div className="rounded-2xl border border-emerald-500/20 bg-(--surface-container-low) p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[0.6rem] font-bold uppercase tracking-widest text-emerald-500">Your story</p>
                <button
                  type="button"
                  onClick={copyNarrative}
                  className="text-xs font-semibold text-neutral-500 hover:text-white transition-colors"
                >
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-sm leading-relaxed text-neutral-200 whitespace-pre-wrap">{narrative}</p>
            </div>
          )}

          {/* Audit report result */}
          {auditReport && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/8 bg-(--surface-container-low) p-4">
                <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-widest text-neutral-500">Summary</p>
                <p className="text-sm text-neutral-200 leading-relaxed">{auditReport.summary}</p>
              </div>

              {auditReport.milestones.length > 0 && (
                <div className="rounded-2xl border border-white/8 bg-(--surface-container-low) p-4">
                  <p className="mb-3 text-[0.6rem] font-bold uppercase tracking-widest text-neutral-500">Milestones</p>
                  <div className="space-y-2">
                    {auditReport.milestones.map((m, i) => (
                      <div key={i} className="rounded-xl bg-white/3 px-3 py-3 text-sm space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white">{m.badge}</span>
                          <HashBadge verified={m.hashVerified} />
                        </div>
                        <p className="text-xs text-neutral-400">{m.date} · {m.criterion}</p>
                        {m.onChainProof && m.onChainProof !== "N/A" && (
                          <a
                            href={m.onChainProof}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[0.65rem] text-violet-400 hover:text-violet-300 transition-colors"
                          >
                            View on Etherscan
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/8 bg-(--surface-container-low) p-4">
                <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-widest text-neutral-500">Assessment</p>
                <p className="text-sm text-neutral-200">{auditReport.overallAssessment}</p>
              </div>

              {auditReport.caveats.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="mb-2 text-[0.6rem] font-bold uppercase tracking-widest text-amber-500">Caveats</p>
                  <ul className="space-y-1 text-xs text-amber-300/80">
                    {auditReport.caveats.map((c, i) => <li key={i}>· {c}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Re-generate button if result exists */}
          {hasResult && (
            <button
              type="button"
              onClick={generateStory}
              disabled={isGenerating}
              className="w-full rounded-xl border border-white/10 py-2 text-sm font-semibold text-neutral-400 transition-colors hover:text-white hover:bg-white/5 disabled:opacity-50"
            >
              Regenerate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

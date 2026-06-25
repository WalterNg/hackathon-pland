"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { CertificatePublicVerifyResult } from "@/app/lib/portfolio-certificate-types";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(ts: string | null) {
  if (!ts) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(ts));
}

function formatUsd(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

function shortHash(hash: string, len = 28) {
  return hash.length > len ? `${hash.slice(0, len / 2)}…${hash.slice(-(len / 2))}` : hash;
}

type AssetRow = { symbol?: string; name?: string; valueUsd?: number };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: CertificatePublicVerifyResult["nftMintStatus"] }) {
  if (status === "minted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-400">
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
        Verified on-chain
      </span>
    );
  }
  if (status === "pending_mint") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-400">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v4.5l3 3M12 3a9 9 0 100 18 9 9 0 000-18z" />
        </svg>
        Pending mint
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-400">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zm9-3.75a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Mint failed
    </span>
  );
}

function ProofRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="shrink-0 text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-200">{value}</span>
    </div>
  );
}

function CertificateCard({ result }: { result: CertificatePublicVerifyResult }) {
  const isMinted = result.nftMintStatus === "minted";
  const etherscanUrl = result.nftTxHash
    ? `https://sepolia.etherscan.io/tx/${result.nftTxHash}`
    : null;

  const payload = result.snapshotPayload;
  const assets: AssetRow[] = Array.isArray(payload?.["assets"]) ? (payload["assets"] as AssetRow[]).slice(0, 10) : [];
  const summary = typeof payload?.["summary"] === "object" && payload["summary"] ? payload["summary"] as Record<string, unknown> : null;
  const metrics = typeof payload?.["metrics"] === "object" && payload["metrics"] ? payload["metrics"] as Record<string, unknown> : null;
  const totalValue = summary?.["totalValueUsd"] ?? metrics?.["total_value_usd"];
  const sharpe = metrics?.["sharpe_ratio_30d"];
  const maxDrawdown = metrics?.["max_drawdown_percent"];

  return (
    <div className="w-full max-w-xl space-y-4">
      {/* Header card */}
      <div className={`rounded-3xl border ${isMinted ? "border-emerald-500/20" : "border-white/8"} bg-(--surface-container-low) overflow-hidden`}>
        <div className={`px-6 pt-6 pb-5 ${isMinted ? "bg-linear-to-b from-[#0d2c1c] to-transparent" : "bg-linear-to-b from-[#111114] to-transparent"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-neutral-500">PLAND Certificate</p>
              <h2 className="mt-1.5 text-lg font-bold text-white">{result.title}</h2>
              {result.achievementKey && (
                <p className="mt-0.5 text-xs text-neutral-400">Achievement: {result.achievementKey}</p>
              )}
            </div>
            <StatusBadge status={result.nftMintStatus} />
          </div>

          {/* Story 5.3: "✓ Verified on-chain | Token #123 | 2026-06-19" line */}
          {isMinted && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-400/80">
              <span className="font-semibold">✓ Verified on-chain</span>
              {result.nftTokenId != null && (
                <>
                  <span className="text-neutral-600">|</span>
                  <span>Token #{result.nftTokenId}</span>
                </>
              )}
              <span className="text-neutral-600">|</span>
              <span>{formatDate(result.snapshotAt)}</span>
            </div>
          )}
        </div>

        {/* Blockchain proof section */}
        <div className="divide-y divide-white/6 border-t border-white/6 px-6">
          <ProofRow label="Network" value="Ethereum Sepolia" />
          <ProofRow
            label="Snapshot hash"
            value={<span className="font-mono text-[0.65rem]">{shortHash(result.snapshotHash)}</span>}
          />
          {result.nftTokenId != null && <ProofRow label="Token ID" value={`#${result.nftTokenId}`} />}
          {result.nftTxHash && (
            <ProofRow
              label="Mint tx"
              value={<span className="font-mono text-[0.65rem]">{shortHash(result.nftTxHash)}</span>}
            />
          )}
          {result.nftContractAddress && (
            <ProofRow
              label="Contract"
              value={<span className="font-mono text-[0.65rem]">{shortHash(result.nftContractAddress)}</span>}
            />
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 px-6 py-4">
          {etherscanUrl && (
            <a
              href={etherscanUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              View on Etherscan
            </a>
          )}
        </div>
      </div>

      {/* Story 5.4: Extended portfolio state for authenticated owner */}
      {payload && (
        <div className="space-y-3">
          {/* Portfolio metrics */}
          {(totalValue !== undefined || sharpe !== undefined || maxDrawdown !== undefined) && (
            <div className="rounded-2xl border border-white/8 bg-(--surface-container-low) p-4">
              <p className="mb-3 text-[0.6rem] font-bold uppercase tracking-widest text-neutral-500">
                Portfolio Metrics at Snapshot
              </p>
              <div className="divide-y divide-white/6">
                {totalValue !== undefined && (
                  <ProofRow label="Total value" value={formatUsd(totalValue)} />
                )}
                {sharpe !== undefined && (
                  <ProofRow label="Sharpe ratio (30d)" value={typeof sharpe === "number" ? sharpe.toFixed(2) : String(sharpe)} />
                )}
                {maxDrawdown !== undefined && (
                  <ProofRow label="Max drawdown" value={typeof maxDrawdown === "number" ? `${maxDrawdown.toFixed(2)}%` : String(maxDrawdown)} />
                )}
              </div>
            </div>
          )}

          {/* Asset breakdown */}
          {assets.length > 0 && (
            <div className="rounded-2xl border border-white/8 bg-(--surface-container-low) p-4">
              <p className="mb-3 text-[0.6rem] font-bold uppercase tracking-widest text-neutral-500">
                Assets at Snapshot
              </p>
              <div className="rounded-xl overflow-hidden border border-white/6">
                {assets.map((asset, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2.5 text-sm ${i % 2 === 0 ? "bg-white/2" : ""}`}
                  >
                    <span className="font-semibold text-white">{asset.symbol ?? asset.name ?? "-"}</span>
                    <span className="text-neutral-400">{formatUsd(asset.valueUsd)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content — reads ?hash= and fetches
// ---------------------------------------------------------------------------

function VerifyContent() {
  const searchParams = useSearchParams();
  const hash = searchParams.get("hash")?.trim() ?? "";

  const [result, setResult] = useState<CertificatePublicVerifyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputHash, setInputHash] = useState(hash);

  useEffect(() => {
    if (!hash) return;
    setInputHash(hash);
    void lookupHash(hash);
  }, [hash]); // eslint-disable-line react-hooks/exhaustive-deps

  async function lookupHash(h: string) {
    const trimmed = h.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Attach Supabase bearer token if available (owner gets extended portfolio data)
      const supabase = await createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/certificates/verify?hash=${encodeURIComponent(trimmed)}`, {
        headers,
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(res.status === 404 ? "No certificate found for this hash." : (data?.detail ?? "Unable to look up certificate."));
        return;
      }

      setResult(data as CertificatePublicVerifyResult);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    params.set("hash", inputHash.trim());
    window.history.replaceState(null, "", `?${params.toString()}`);
    void lookupHash(inputHash);
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-16 sm:px-6">
      {/* Logo / nav back */}
      <div className="mb-10 w-full max-w-xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-400 hover:text-white transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          PLAND
        </Link>
      </div>

      <div className="w-full max-w-xl">
        {/* Heading */}
        <div className="mb-8 text-center">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-neutral-500">On-chain verification</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Verify a Portfolio Certificate</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Paste a snapshot hash to confirm it was certified and minted as an NFT on Ethereum Sepolia.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputHash}
              onChange={(e) => setInputHash(e.target.value)}
              placeholder="0x1234abcd…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white placeholder-neutral-600 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
            />
            <button
              type="submit"
              disabled={isLoading || !inputHash.trim()}
              className="shrink-0 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
            >
              {isLoading ? "Checking…" : "Verify"}
            </button>
          </div>
        </form>

        {/* States */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-16 text-neutral-500">
            <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">Looking up certificate…</span>
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!isLoading && !error && result && <CertificateCard result={result} />}

        {!isLoading && !error && !result && !hash && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/4">
              <svg className="h-6 w-6 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-neutral-400">Enter a snapshot hash to verify</p>
              <p className="mt-1 text-sm text-neutral-600">The hash is shown on each portfolio certificate.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <span className="text-sm text-neutral-500">Loading…</span>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

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

export type StoryMode = "share" | "audit";

async function fetchWithAuth(path: string, init: RequestInit = {}) {
  const supabase = await createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return fetch(path, { ...init, headers, cache: "no-store" });
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function resolveAuditMarkdown(payload: unknown): string | null {
  if (!payload) return null;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  if (typeof record.audit_markdown === "string" && record.audit_markdown.trim().length > 0) {
    return record.audit_markdown;
  }
  if (typeof record.markdown === "string" && record.markdown.trim().length > 0) {
    return record.markdown;
  }
  if (typeof record.report === "string" && record.report.trim().length > 0) {
    return record.report;
  }

  return null;
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div
      className="prose prose-sm prose-invert max-w-none
      prose-p:text-neutral-200 prose-p:leading-relaxed
      prose-strong:text-white prose-strong:font-semibold
      prose-em:text-neutral-300
      prose-headings:text-white prose-headings:font-bold
      prose-h1:text-base prose-h2:text-base prose-h3:text-sm
      prose-ul:text-neutral-300 prose-ol:text-neutral-300
      prose-li:marker:text-neutral-500
      prose-blockquote:border-violet-500 prose-blockquote:text-neutral-400
      prose-hr:border-white/10
      prose-table:text-neutral-300 prose-th:text-white prose-td:border-white/8"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export function StorytellingChooserPopover({
  onChoose,
}: {
  onChoose: (mode: StoryMode) => void;
}) {
  return (
    <div className="w-71.5 rounded-3xl border border-white/10 bg-(--surface-container-high) p-3 shadow-2xl ring-1 ring-white/10">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChoose("share")}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20 hover:text-emerald-300"
        >
          Share
        </button>
        <button
          type="button"
          onClick={() => onChoose("audit")}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20 hover:text-emerald-300"
        >
          Audit
        </button>
      </div>
    </div>
  );
}

type StorytellingModalProps = {
  onClose: () => void;
  portfolioId: string | null;
  portfolioName: string;
  mode: StoryMode;
};

export function StorytellingModal({ onClose, portfolioId, portfolioName, mode }: StorytellingModalProps) {
  const [nfts, setNfts] = useState<ChainNft[] | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [status, setStatus] = useState<"reading" | "writing" | "ready" | "error">("reading");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setStatus("reading");
      setError(null);
      setCopied(false);
      setContent(null);
      setNfts(null);

      try {
        const url = portfolioId
          ? `/api/storytelling/nfts?portfolio_id=${encodeURIComponent(portfolioId)}`
          : "/api/storytelling/nfts";
        const nftsRes = await fetchWithAuth(url);
        const nftsData = await nftsRes.json().catch(() => null);
        if (!nftsRes.ok) throw new Error(nftsData?.detail ?? "Failed to load NFTs from chain.");

        const loadedNfts = ((nftsData as { nfts: ChainNft[] }).nfts ?? []).filter(Boolean);
        if (cancelled) return;
        setNfts(loadedNfts);

        setStatus("writing");
        const res = await fetchWithAuth("/api/storytelling/generate", {
          method: "POST",
          body: JSON.stringify({ mode, portfolio_id: portfolioId ?? null }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.detail ?? "Story generation failed.");

        const nextContent = mode === "share"
          ? ((data as { narrative: string }).narrative ?? "")
          : (resolveAuditMarkdown(data) ?? "");

        if (cancelled) return;
        setContent(nextContent);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Story generation failed.");
        setStatus("error");
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [mode, portfolioId]);

  async function copyContent() {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-(--surface-container-high) shadow-2xl ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div>
            <p className={`text-[0.65rem] font-bold uppercase tracking-[0.2em] ${mode === "share" ? "text-emerald-500" : "text-violet-400"}`}>
              {mode === "share" ? "Share" : "Audit"}
            </p>
            <h2 className="mt-1 text-lg font-bold text-white">Get My Story</h2>
            <p className="mt-0.5 text-xs text-neutral-400">{portfolioName}</p>
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

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Status</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.7rem] font-semibold text-neutral-300">
                {status === "reading" && "Reading from blockchain"}
                {status === "writing" && (mode === "audit" ? "Generating report..." : "Writing with AI")}
                {status === "ready" && "Ready"}
                {status === "error" && "Failed"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={copyContent}
                className="text-xs font-semibold text-neutral-500 transition-colors hover:text-white"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {!error && (
            <div className="rounded-2xl border border-white/8 bg-(--surface-container-low) px-5 py-4 text-xs text-neutral-400">
              {nfts
                ? `${nfts.length} certificate${nfts.length === 1 ? "" : "s"} fetched from blockchain.`
                : "Fetching certificates from blockchain..."}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/8 bg-(--surface-container-low) px-5 py-5">
            {status === "reading" || status === "writing" ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-neutral-500">
                <Spinner />
                <p className="text-sm">{status === "reading" ? "Reading from blockchain..." : "Writing with AI..."}</p>
              </div>
            ) : content ? (
              <MarkdownContent content={content} />
            ) : (
              <div className="flex min-h-72 items-center justify-center text-sm text-neutral-500">
                No content generated.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

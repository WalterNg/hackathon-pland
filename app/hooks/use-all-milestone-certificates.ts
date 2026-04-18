"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { backendBaseUrl } from "@/app/lib/backend-base-url";
import type {
  PortfolioSnapshotCertificate,
  PortfolioSnapshotCertificateDetail,
  PortfolioSnapshotCertificateVerificationResult,
} from "@/app/lib/portfolio-certificate-types";
import type { PortfolioItem } from "@/app/hooks/use-portfolios";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

async function fetchBackendWithAuth(path: string, init: RequestInit = {}) {
  const supabase = await createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(`${backendBaseUrl()}${path}`, { ...init, headers, cache: "no-store" });
}

export type MilestoneCertificate = PortfolioSnapshotCertificate & {
  portfolioName: string;
};

type UseAllMilestoneCertificatesResult = {
  milestones: MilestoneCertificate[];
  isLoading: boolean;
  error: string | null;
  selectedCertificate: PortfolioSnapshotCertificateDetail | null;
  isVerifying: boolean;
  verificationResult: PortfolioSnapshotCertificateVerificationResult | null;
  openCertificate: (certificateId: string) => Promise<void>;
  closeCertificate: () => void;
  verifyCertificate: (certificateId: string) => Promise<void>;
  reload: () => Promise<void>;
};

export function useAllMilestoneCertificates(portfolios: PortfolioItem[]): UseAllMilestoneCertificatesResult {
  const [milestones, setMilestones] = useState<MilestoneCertificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<PortfolioSnapshotCertificateDetail | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<PortfolioSnapshotCertificateVerificationResult | null>(null);

  // Stable key — only changes when the actual portfolio IDs change, not on every render
  const portfolioKey = portfolios.map((p) => p.id).join(",");
  const portfoliosRef = useRef(portfolios);
  portfoliosRef.current = portfolios;

  const reload = useCallback(async () => {
    const currentPortfolios = portfoliosRef.current;
    if (currentPortfolios.length === 0) return;
    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        currentPortfolios.map(async (portfolio) => {
          const params = new URLSearchParams({ portfolio_id: portfolio.id });
          const response = await fetchBackendWithAuth(`/api/portfolio_snapshot_certificates?${params}`);
          if (!response.ok) return [];
          const payload = (await response.json().catch(() => null)) as { certificates?: PortfolioSnapshotCertificate[] } | null;
          return (payload?.certificates ?? []).map((cert) => ({ ...cert, portfolioName: portfolio.name }));
        })
      );

      const all = results.flat().sort((a, b) => new Date(b.snapshotAt).getTime() - new Date(a.snapshotAt).getTime());
      setMilestones(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load milestones.");
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (portfolioKey) {
      void reload();
    }
  // portfolioKey is the stable dep — reload is stable (empty deps), portfoliosRef always current
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioKey]);

  const openCertificate = useCallback(async (certificateId: string) => {
    const response = await fetchBackendWithAuth(`/api/portfolio_snapshot_certificates/${certificateId}`);
    const payload = (await response.json().catch(() => null)) as PortfolioSnapshotCertificateDetail & { detail?: string } | null;
    if (response.ok && payload) {
      setSelectedCertificate(payload);
      setVerificationResult(null);
    }
  }, []);

  const closeCertificate = useCallback(() => {
    setSelectedCertificate(null);
    setVerificationResult(null);
  }, []);

  const verifyCertificate = useCallback(async (certificateId: string) => {
    setIsVerifying(true);
    try {
      const response = await fetchBackendWithAuth(`/api/portfolio_snapshot_certificates/${certificateId}/verify`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => null)) as PortfolioSnapshotCertificateVerificationResult | null;
      if (response.ok && payload) {
        setVerificationResult(payload);
      }
    } finally {
      setIsVerifying(false);
    }
  }, []);

  return {
    milestones,
    isLoading,
    error,
    selectedCertificate,
    isVerifying,
    verificationResult,
    openCertificate,
    closeCertificate,
    verifyCertificate,
    reload,
  };
}

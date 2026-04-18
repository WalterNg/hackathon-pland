"use client";

import { useCallback, useEffect, useState } from "react";

import { backendBaseUrl } from "@/app/lib/backend-base-url";
import type {
  PortfolioSnapshotCertificate,
  PortfolioSnapshotCertificateDetail,
  PortfolioSnapshotCertificateVerificationResult,
} from "@/app/lib/portfolio-certificate-types";
import type { PortfolioSnapshot } from "@/app/lib/portfolio-types";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

async function fetchBackendWithSupabaseAuth(path: string, init: RequestInit = {}) {
  const supabase = await createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

type UsePortfolioSnapshotCertificatesResult = {
  certificates: PortfolioSnapshotCertificate[];
  selectedCertificate: PortfolioSnapshotCertificateDetail | null;
  isLoading: boolean;
  isCreating: boolean;
  isVerifying: boolean;
  error: string | null;
  createCertificate: (input: {
    portfolioId?: string | null;
    portfolioName?: string;
    snapshotPayload?: PortfolioSnapshot | null;
    certifyMode?: "manual" | "auto_achievement";
    title?: string;
    note?: string;
    achievementKey?: string;
  }) => Promise<PortfolioSnapshotCertificateDetail | null>;
  getCertificate: (certificateId: string) => Promise<PortfolioSnapshotCertificateDetail | null>;
  verifyCertificate: (certificateId: string) => Promise<PortfolioSnapshotCertificateVerificationResult | null>;
  reload: () => Promise<void>;
};

export function usePortfolioSnapshotCertificates(
  portfolioId: string | null,
  portfolioName: string
): UsePortfolioSnapshotCertificatesResult {
  const [certificates, setCertificates] = useState<PortfolioSnapshotCertificate[]>([]);
  const [selectedCertificate, setSelectedCertificate] = useState<PortfolioSnapshotCertificateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      if (portfolioId?.trim()) {
        searchParams.set("portfolio_id", portfolioId.trim());
      } else {
        searchParams.set("portfolio_name", portfolioName);
      }

      const response = await fetchBackendWithSupabaseAuth(`/api/portfolio_snapshot_certificates?${searchParams.toString()}`);
      const payload = (await response.json().catch(() => null)) as
        | { certificates?: PortfolioSnapshotCertificate[]; detail?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to load snapshot certificates.");
      }

      setCertificates(payload?.certificates ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load snapshot certificates.");
    } finally {
      setIsLoading(false);
    }
  }, [portfolioId, portfolioName]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createCertificate = useCallback(
    async ({
      portfolioId: nextPortfolioId,
      portfolioName: nextPortfolioName,
      snapshotPayload,
      certifyMode,
      title,
      note,
      achievementKey,
    }: {
      portfolioId?: string | null;
      portfolioName?: string;
      snapshotPayload?: PortfolioSnapshot | null;
      certifyMode?: "manual" | "auto_achievement";
      title?: string;
      note?: string;
      achievementKey?: string;
    }) => {
      setIsCreating(true);
      setError(null);

      try {
        const response = await fetchBackendWithSupabaseAuth("/api/portfolio_snapshot_certificates", {
          method: "POST",
          body: JSON.stringify({
            portfolioId: nextPortfolioId?.trim() || undefined,
            portfolioName: nextPortfolioName?.trim() || undefined,
            snapshotPayload: snapshotPayload ?? undefined,
            certifyMode: certifyMode ?? "manual",
            title: title?.trim() || undefined,
            note: note?.trim() || undefined,
            achievementKey: achievementKey?.trim() || undefined,
          }),
        });
        const payload = (await response.json().catch(() => null)) as PortfolioSnapshotCertificateDetail & { detail?: string };
        if (!response.ok) {
          throw new Error(payload?.detail || "Unable to create snapshot certificate.");
        }

        setSelectedCertificate(payload);
        await reload();
        return payload;
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Unable to create snapshot certificate.");
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [reload]
  );

  const getCertificate = useCallback(async (certificateId: string) => {
    try {
      const response = await fetchBackendWithSupabaseAuth(`/api/portfolio_snapshot_certificates/${certificateId}`);
      const payload = (await response.json().catch(() => null)) as PortfolioSnapshotCertificateDetail & { detail?: string };
      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to load certificate detail.");
      }
      setSelectedCertificate(payload);
      return payload;
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Unable to load certificate detail.");
      return null;
    }
  }, []);

  const verifyCertificate = useCallback(async (certificateId: string) => {
    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetchBackendWithSupabaseAuth(`/api/portfolio_snapshot_certificates/${certificateId}/verify`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => null)) as PortfolioSnapshotCertificateVerificationResult & { detail?: string };
      if (!response.ok) {
        throw new Error(payload?.detail || "Unable to verify certificate.");
      }

      const updatedDetail = await getCertificate(certificateId);
      if (updatedDetail) {
        setSelectedCertificate(updatedDetail);
      }
      await reload();
      return payload;
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Unable to verify certificate.");
      return null;
    } finally {
      setIsVerifying(false);
    }
  }, [getCertificate, reload]);

  return {
    certificates,
    selectedCertificate,
    isLoading,
    isCreating,
    isVerifying,
    error,
    createCertificate,
    getCertificate,
    verifyCertificate,
    reload,
  };
}

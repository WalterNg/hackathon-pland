"use client";

import { useState } from "react";
import { fetchWithSupabaseAuth } from "@/app/lib/supabase/authenticated-fetch";

export type TransactionAction = "buy" | "sell" | "transfer";
export type TransferDirection = "in" | "out";

export type AddTransactionInput = {
  portfolioName: string;
  symbol: string;
  action: TransactionAction;
  transferDirection?: TransferDirection;
  quantity: number;
  priceUsd: number;
  feeUsd: number;
  note?: string;
  executedAt: string;
};

type UseAddTransactionResult = {
  isSubmitting: boolean;
  error: string | null;
  submitTransaction: (input: AddTransactionInput) => Promise<boolean>;
};

export function useAddTransaction(): UseAddTransactionResult {
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTransaction = async (input: AddTransactionInput) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetchWithSupabaseAuth("/api/portfolio/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Unable to create transaction.");
      }

      return true;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create transaction.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { isSubmitting, error, submitTransaction };
}

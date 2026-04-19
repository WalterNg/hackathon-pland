"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RiskAlertToast } from "./risk-alert-toast";

function ToastInner() {
  const searchParams = useSearchParams();
  const portfolioName = searchParams.get("name")?.trim() || "Main Portfolio";
  return <RiskAlertToast portfolioName={portfolioName} />;
}

export function RiskAlertToastProvider() {
  return (
    <Suspense fallback={null}>
      <ToastInner />
    </Suspense>
  );
}

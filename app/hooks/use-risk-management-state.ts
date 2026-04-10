"use client";

import { useCallback } from "react";
import { useRiskAlerts } from "./use-risk-alerts";
import { useRiskEvents } from "./use-risk-events";
import { useRiskRules } from "./use-risk-rules";
import type { RiskAlertStatus, RiskRulesFormValues } from "@/app/lib/risk-types";

type UseRiskManagementStateResult = {
  profile: ReturnType<typeof useRiskEvents>["profile"];
  events: ReturnType<typeof useRiskEvents>["events"];
  alerts: ReturnType<typeof useRiskEvents>["alerts"];
  isRiskLoading: boolean;
  riskError: string | null;
  editableRiskProfile: ReturnType<typeof useRiskRules>["profile"];
  riskRuleSource: ReturnType<typeof useRiskRules>["source"];
  isRiskRulesLoading: boolean;
  isRiskRulesSaving: boolean;
  riskRulesError: string | null;
  alertCenterAlerts: ReturnType<typeof useRiskAlerts>["alerts"];
  isAlertCenterLoading: boolean;
  updatingAlertId: string | null;
  alertCenterError: string | null;
  handleSaveRiskRules: (values: RiskRulesFormValues) => Promise<boolean>;
  handleAcknowledgeAlert: (alertId: string) => Promise<boolean>;
  handleResolveAlert: (alertId: string) => Promise<boolean>;
};

export function useRiskManagementState(
  portfolioId: string | null,
  portfolioName: string,
  alertStatus: RiskAlertStatus | "all"
): UseRiskManagementStateResult {
  const {
    profile,
    events,
    alerts,
    isLoading: isRiskLoading,
    error: riskError,
    reload: reloadRisk,
  } = useRiskEvents(portfolioId, portfolioName);
  const {
    profile: editableRiskProfile,
    source: riskRuleSource,
    isLoading: isRiskRulesLoading,
    isSaving: isRiskRulesSaving,
    error: riskRulesError,
    save: saveRiskRules,
    reload: reloadRiskRules,
  } = useRiskRules(portfolioName);
  const {
    alerts: alertCenterAlerts,
    isLoading: isAlertCenterLoading,
    isUpdatingId: updatingAlertId,
    error: alertCenterError,
    reload: reloadAlertCenter,
    acknowledge,
    resolve,
  } = useRiskAlerts(portfolioName, alertStatus, 15_000, true);

  const handleSaveRiskRules = useCallback(async (values: RiskRulesFormValues) => {
    const saved = await saveRiskRules(values);
    if (!saved) {
      return false;
    }

    await Promise.all([reloadRiskRules(), reloadRisk(), reloadAlertCenter()]);
    return true;
  }, [reloadAlertCenter, reloadRisk, reloadRiskRules, saveRiskRules]);

  const handleAcknowledgeAlert = useCallback(async (alertId: string) => {
    const ok = await acknowledge(alertId);
    if (!ok) {
      return false;
    }

    await Promise.all([reloadRisk(), reloadAlertCenter()]);
    return true;
  }, [acknowledge, reloadAlertCenter, reloadRisk]);

  const handleResolveAlert = useCallback(async (alertId: string) => {
    const ok = await resolve(alertId);
    if (!ok) {
      return false;
    }

    await Promise.all([reloadRisk(), reloadAlertCenter()]);
    return true;
  }, [reloadAlertCenter, reloadRisk, resolve]);

  return {
    profile,
    events,
    alerts,
    isRiskLoading,
    riskError,
    editableRiskProfile,
    riskRuleSource,
    isRiskRulesLoading,
    isRiskRulesSaving,
    riskRulesError,
    alertCenterAlerts,
    isAlertCenterLoading,
    updatingAlertId,
    alertCenterError,
    handleSaveRiskRules,
    handleAcknowledgeAlert,
    handleResolveAlert,
  };
}
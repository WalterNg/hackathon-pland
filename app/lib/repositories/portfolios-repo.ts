import type { SupabaseClient } from "@supabase/supabase-js";
import { getLatestPortfolioSnapshotCache } from "./portfolio-snapshots-repo";

const MAIN_PORTFOLIO_NAME = "Main Portfolio";

export type UserPortfolio = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  totalValueBtc: number | null;
};

type PortfolioRow = {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
};

function toUserPortfolio(row: PortfolioRow): UserPortfolio {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    createdAt: row.created_at,
    totalValueBtc: null
  };
}

export async function ensureMainPortfolio(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPortfolio | null> {
  const { data: existingMain, error: mainError } = await supabase
    .from("portfolios")
    .select("id, name, is_default, created_at")
    .eq("user_id", userId)
    .eq("name", MAIN_PORTFOLIO_NAME)
    .maybeSingle();

  if (!mainError && existingMain?.id) {
    if (!existingMain.is_default) {
      const { data: updatedMain } = await supabase
        .from("portfolios")
        .update({ is_default: true })
        .eq("id", existingMain.id)
        .eq("user_id", userId)
        .select("id, name, is_default, created_at")
        .maybeSingle();

      if (updatedMain) {
        return toUserPortfolio(updatedMain as PortfolioRow);
      }
    }

    return toUserPortfolio(existingMain as PortfolioRow);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("portfolios")
    .insert({
      user_id: userId,
      name: MAIN_PORTFOLIO_NAME,
      is_default: true
    })
    .select("id, name, is_default, created_at")
    .maybeSingle();

  if (insertError || !inserted?.id) {
    return null;
  }

  return toUserPortfolio(inserted as PortfolioRow);
}

export async function listUserPortfolios(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPortfolio[]> {
  await ensureMainPortfolio(supabase, userId);

  const { data, error } = await supabase
    .from("portfolios")
    .select("id, name, is_default, created_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  const basePortfolios = (data as PortfolioRow[]).map(toUserPortfolio);

  const portfoliosWithTotals = await Promise.all(
    basePortfolios.map(async (portfolio) => {
      const snapshot = await getLatestPortfolioSnapshotCache(supabase, userId, portfolio.id);

      return {
        ...portfolio,
        totalValueBtc: snapshot?.summary.totalValueBtc ?? null
      };
    })
  );

  return portfoliosWithTotals;
}

export async function createUserPortfolio(
  supabase: SupabaseClient,
  userId: string,
  inputName: string
): Promise<{ portfolio: UserPortfolio | null; errorCode: "invalid-name" | "duplicate" | "unknown" | null }> {
  const name = inputName.trim();
  if (!name) {
    return { portfolio: null, errorCode: "invalid-name" };
  }

  await ensureMainPortfolio(supabase, userId);

  const { data, error } = await supabase
    .from("portfolios")
    .insert({
      user_id: userId,
      name,
      is_default: false
    })
    .select("id, name, is_default, created_at")
    .maybeSingle();

  if (error || !data?.id) {
    const message = `${(error as { message?: string } | null)?.message ?? ""}`.toLowerCase();
    if (message.includes("duplicate") || message.includes("unique")) {
      return { portfolio: null, errorCode: "duplicate" };
    }

    return { portfolio: null, errorCode: "unknown" };
  }

  return { portfolio: toUserPortfolio(data as PortfolioRow), errorCode: null };
}

export async function deleteUserPortfolio(
  supabase: SupabaseClient,
  userId: string,
  inputName: string
): Promise<{ success: boolean; errorCode: "invalid-name" | "default-portfolio" | "not-found" | "unknown" | null }> {
  const name = inputName.trim();
  if (!name) {
    return { success: false, errorCode: "invalid-name" };
  }

  if (name === MAIN_PORTFOLIO_NAME) {
    return { success: false, errorCode: "default-portfolio" };
  }

  const { data: targetPortfolio, error: selectError } = await supabase
    .from("portfolios")
    .select("id, is_default")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();

  if (selectError) {
    return { success: false, errorCode: "unknown" };
  }

  if (!targetPortfolio?.id) {
    return { success: false, errorCode: "not-found" };
  }

  if (targetPortfolio.is_default) {
    return { success: false, errorCode: "default-portfolio" };
  }

  const { error: deleteError } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", targetPortfolio.id)
    .eq("user_id", userId);

  if (deleteError) {
    return { success: false, errorCode: "unknown" };
  }

  return { success: true, errorCode: null };
}

export async function resolveUserPortfolioByName(
  supabase: SupabaseClient,
  userId: string,
  portfolioName: string
): Promise<UserPortfolio | null> {
  const name = portfolioName.trim() || MAIN_PORTFOLIO_NAME;

  if (name === MAIN_PORTFOLIO_NAME) {
    return ensureMainPortfolio(supabase, userId);
  }

  const { data, error } = await supabase
    .from("portfolios")
    .select("id, name, is_default, created_at")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();

  if (error || !data?.id) {
    return null;
  }

  return toUserPortfolio(data as PortfolioRow);
}

export { MAIN_PORTFOLIO_NAME };
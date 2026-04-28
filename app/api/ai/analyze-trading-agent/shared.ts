import { createSupabaseServerClient } from "@/app/lib/supabase/server";
import { getSupabaseAuthContext } from "@/app/lib/supabase/request-auth";
import { resolveUserPortfolioByName } from "@/app/lib/repositories/portfolios-repo";

const DEFAULT_PORTFOLIO_NAME = "Main Portfolio";

export async function getAuthContext(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (authorization) {
    return getSupabaseAuthContext(request);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

export async function getAuthorizedPortfolio(request: Request, portfolioNameInput?: string | null) {
  const { supabase, user } = await getAuthContext(request);
  const portfolioName = portfolioNameInput?.trim() || DEFAULT_PORTFOLIO_NAME;

  if (!user?.id) {
    return { supabase, user, portfolio: null, portfolioName };
  }

  const portfolio = await resolveUserPortfolioByName(supabase, user.id, portfolioName);
  return { supabase, user, portfolio, portfolioName };
}

export function normalizePortfolioUiSessionId(input: string | null | undefined): string | null {
  const value = input?.trim();
  return value ? value.slice(0, 128) : null;
}

export { DEFAULT_PORTFOLIO_NAME };

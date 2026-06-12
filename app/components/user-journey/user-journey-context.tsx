"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type JourneyStep = {
  id: string;
  /** CSS selector or [data-tour="..."] attribute target. Null = centered modal (no spotlight). */
  target: string | null;
  title: string;
  description: string | ReactNode;
  /** Preferred tooltip placement relative to the target */
  placement?: "top" | "bottom" | "left" | "right" | "center";
  /** Extra padding around the spotlight hole */
  padding?: number;
  /** If true, clicking the highlighted element auto-advances to next step */
  advanceOnTargetClick?: boolean;
  /** If true, clicking Next will programmatically click the target element before advancing */
  autoClickTargetOnNext?: boolean;
  /** Extra ms delay before computing the target rect (for steps where DOM settles slowly) */
  delay?: number;
  /** Fine-tune the spotlight rect per side (positive = expand outward, negative = shrink inward) */
  rectAdjust?: { top?: number; left?: number; right?: number; bottom?: number };
  /** Hide the Next button — user must interact with the spotlight element to advance */
  hideNext?: boolean;
  /** Auto-advance to next step when user clicks anywhere inside the spotlight */
  advanceOnSpotlightClick?: boolean;
  /** CSS selector of a specific child element whose click triggers advance (overrides advanceOnSpotlightClick target) */
  advanceOnClickSelector?: string;
  /** Actions to run when this step becomes active (e.g. close a modal, reopen another) */
  enterActions?: Array<{ selector: string; delay?: number }>;
};

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Welcome to Pland!",
    description:
      "Let us walk you through the key features of the app — from creating a portfolio and adding transactions, to advanced AI analysis. It only takes about 2 minutes!",
    placement: "center",
  },
  {
    id: "create-portfolio",
    target: '[data-tour="create-portfolio-btn"]',
    title: "Create a Portfolio",
    description:
      'Start by creating a new portfolio. Click "+ Create portfolio" in the left sidebar. A portfolio is where you track all of your crypto assets.',
    placement: "right",
    padding: 8,
  },
  {
    id: "add-transaction",
    target: '[data-tour="add-transaction-btn"]',
    title: "Add a Transaction",
    description:
      'Once you have a portfolio, add your first transaction. Click "+ Add transaction" to record a buy or sell order. Pland will automatically calculate P&L and cost basis for you.',
    placement: "bottom",
    padding: 8,
    autoClickTargetOnNext: true,
  },
  {
    id: "select-coin",
    target: '[data-tour="select-coin-modal"]',
    title: "Select a Coin",
    description:
      "Choose the coin you want to add to your transaction. Search by name or ticker symbol, then click a coin to continue.",
    placement: "left",
    padding: 10,
    delay: 400,
    hideNext: true,
    advanceOnSpotlightClick: true,
    enterActions: [
      { selector: 'button[aria-label="Close add transaction"]', delay: 0 },
      { selector: '[data-tour="add-transaction-btn"]', delay: 150 },
    ],
  },
  {
    id: "fill-transaction",
    target: '[data-tour="add-transaction-form"]',
    title: "Fill in the Transaction",
    description:
      "Enter the quantity and price for your transaction. You can also set the date, add a fee, and include notes. When done, click \"Add Transaction\" to save it to your portfolio.",
    placement: "left",
    padding: 10,
    delay: 400,
    hideNext: true,
    advanceOnClickSelector: '[data-tour="submit-add-transaction"]',
  },
  {
    id: "portfolio-summary",
    target: '[data-tour="portfolio-value-left"] || [data-tour="tab-milestones"]',
    title: "Total Value & Tabs",
    description:
      "This area shows your portfolio's total value in real time. Below it you'll find tabs: Portfolio Overview, AI History (past AI analyses), Risk Rules, and Milestones.",
    placement: "right",
    padding: 12,
    rectAdjust: { top: 90 },
  },
  {
    id: "portfolio-metrics",
    target: '[data-tour="portfolio-metrics"]',
    title: "Metrics — 3 Pages of Stats",
    description:
      "Here you'll find your most important numbers across 3 pages: (1) P&L, Cost Basis, Sharpe Ratio, Max Drawdown — (2) Risk Score, Volatility, Concentration — (3) Sortino, Calmar, VaR. Use the arrows to navigate between pages.",
    placement: "top",
    padding: 12,
  },
  {
    id: "portfolio-charts",
    target: '[data-tour="portfolio-charts"]',
    title: "Performance Charts",
    description:
      "Charts display portfolio performance across 24H, 7D, 30D, 90D, and ALL timeframes. On the left, the Allocation chart shows the weight of each coin in your portfolio.",
    placement: "top",
    padding: 12,
  },
  {
    id: "portfolio-assets",
    target: '[data-tour="portfolio-assets"]',
    title: "Asset List",
    description:
      "The Assets table lists all coins you currently hold, with current price, quantity, value, and P&L. The Transactions tab lets you view your full buy/sell history.",
    placement: "top",
    padding: 8,
  },
  {
    id: "analyze-ai",
    target: '#analyze-with-ai-btn',
    title: "Analyze with AI",
    description:
      'Click "Analyze with AI" to have the AI review your entire portfolio — identifying risks, spotting opportunities, and providing specific trading recommendations. Results are saved under the "AI History" tab.',
    placement: "bottom",
    padding: 8,
    advanceOnClickSelector: '#analyze-with-ai-btn',
  },
  {
    id: "ai-history-tab",
    target: '[data-tour="tab-ai-history"]',
    title: "Portfolio Tabs",
    description:
      "These tabs give you different views of your portfolio. Portfolio Overview shows your holdings and performance. AI History stores all past AI analyses. Risk Rules lets you set custom alerts. Milestones tracks your investment journey.",
    placement: "bottom",
    padding: 8,
  },
  {
    id: "forecast",
    target: '[data-tour="forecast-btn"]',
    title: "Portfolio Forecast",
    description:
      "The Forecast feature projects your portfolio's future value using Monte Carlo simulation and historical data. Click the Forecast button on the chart to see optimistic, base, and pessimistic scenarios.",
    placement: "top",
    padding: 8,
  },
  {
    id: "checkpoint",
    target: '[data-tour="certify-snapshot-btn"]',
    title: "Checkpoint & Portfolio Journey",
    description:
      "Checkpoint lets you save a snapshot of your portfolio at a meaningful moment — like hitting a new profit milestone or after a major investment decision. This is the foundation of Portfolio Journey — a gamification layer that helps you track your investing story over time!",
    placement: "bottom",
    padding: 8,
  },
  {
    id: "done",
    target: null,
    title: "You're all set!",
    description:
      "You've explored the key features of Pland. Get started by creating a portfolio and adding your first transaction. Happy investing!",
    placement: "center",
  },
];

// --- Context ---

type UserJourneyContextType = {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: JourneyStep | null;
  totalSteps: number;
  startJourney: () => void;
  nextStep: () => void;
  prevStep: () => void;
  endJourney: () => void;
  goToStep: (index: number) => void;
};

const UserJourneyContext = createContext<UserJourneyContextType | null>(null);

export function UserJourneyProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const startJourney = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const endJourney = useCallback(() => {
    setIsActive(false);
    setCurrentStepIndex(0);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const next = prev + 1;
      if (next >= JOURNEY_STEPS.length) {
        setIsActive(false);
        return 0;
      }
      return next;
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goToStep = useCallback((index: number) => {
    setCurrentStepIndex(Math.max(0, Math.min(index, JOURNEY_STEPS.length - 1)));
  }, []);

  const currentStep = isActive ? (JOURNEY_STEPS[currentStepIndex] ?? null) : null;

  return (
    <UserJourneyContext.Provider
      value={{
        isActive,
        currentStepIndex,
        currentStep,
        totalSteps: JOURNEY_STEPS.length,
        startJourney,
        nextStep,
        prevStep,
        endJourney,
        goToStep,
      }}
    >
      {children}
    </UserJourneyContext.Provider>
  );
}

export function useUserJourney() {
  const ctx = useContext(UserJourneyContext);
  if (!ctx) throw new Error("useUserJourney must be used inside UserJourneyProvider");
  return ctx;
}

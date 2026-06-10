"use client";

import { JournalActivity } from "@/app/components/journal/journal-activity";
import { JournalInsights } from "@/app/components/journal/journal-insights";
import { JournalKpis } from "@/app/components/journal/journal-kpis";
import { useJournalSummary } from "@/app/hooks/use-journal-summary";

type TabJournalProps = {
  portfolioName: string;
};

export function TabJournal({ portfolioName }: TabJournalProps) {
  const { summary, isLoading, error } = useJournalSummary(30, portfolioName);

  return (
    <>
      <section className="mb-4">
        <h2 className="text-xl font-bold text-strong">Trading Journal</h2>
      </section>

      {error && (
        <div className="panel-low mb-4 p-5 text-sm text-danger">
          Unable to load journal data: {error}
        </div>
      )}

      <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden lg:flex-row">
        <div className="min-w-0 lg:flex-3">
          <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
            <JournalKpis summary={summary} isLoading={isLoading} />
            <JournalActivity summary={summary} isLoading={isLoading} />
          </div>
        </div>
        <div className="min-w-0 lg:flex-1">
          <JournalInsights summary={summary} isLoading={isLoading} />
        </div>
      </div>
    </>
  );
}

"use client";

import { JournalActivity } from "../components/journal/journal-activity";
import { JournalHeader } from "../components/journal/journal-header";
import { JournalInsights } from "../components/journal/journal-insights";
import { JournalKpis } from "../components/journal/journal-kpis";
import { useJournalSummary } from "../hooks/use-journal-summary";

export default function JournalPage() {
  const { summary, isLoading, error } = useJournalSummary(30);

  return (
    <>
      <JournalHeader />

      <div className="app-shell box-border overflow-hidden">
        <main className="app-main overflow-hidden px-4 pt-5 sm:px-6 lg:px-8">
          <div className="content-shell flex h-full min-h-0 flex-1 flex-col pb-6">
            <section className="mb-4">
              <h2 className="typo-h1 text-strong">Trading Journal</h2>
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
          </div>
        </main>
      </div>
    </>
  );
}

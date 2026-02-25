"use client";

import { JournalActivity } from "../components/journal/journal-activity";
import { JournalHeader } from "../components/journal/journal-header";
import { JournalInsights } from "../components/journal/journal-insights";
import { JournalKpis } from "../components/journal/journal-kpis";
import { Sidebar } from "../components/ui/sidebar";
import { useJournalSummary } from "../hooks/use-journal-summary";

export default function JournalPage() {
  const { summary, isLoading, error } = useJournalSummary(30);

  return (
    <div className="flex h-screen overflow-hidden bg-background box-border">
      <Sidebar />

      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden px-4 pt-2 sm:px-6 lg:px-8">
        <div className="content-shell flex h-full min-h-0 flex-1 flex-col">
          <JournalHeader />

          {error && (
            <div className="mb-4 rounded-2xl border border-gray-100 bg-card-light p-5 text-sm text-danger">
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
  );
}

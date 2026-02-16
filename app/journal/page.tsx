"use client";

import { JournalActivity } from "../components/journal/journal-activity";
import { JournalHeader } from "../components/journal/journal-header";
import { JournalInsights } from "../components/journal/journal-insights";
import { JournalKpis } from "../components/journal/journal-kpis";
import { Sidebar } from "../components/ui/sidebar";

export default function JournalPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background box-border">
      <Sidebar />

      <main className="ml-4 flex h-full flex-1 flex-col overflow-hidden">
        <JournalHeader />

        <div className="flex h-full flex-1 gap-4 overflow-hidden">
          <div className="flex-3 min-w-0">
            <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
              <JournalKpis />
              <JournalActivity />
            </div>
          </div>

          <JournalInsights />
        </div>
      </main>
    </div>
  );
}

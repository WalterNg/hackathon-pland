export function JournalHeader() {
  return (
    <header className="mb-4 flex h-20 shrink-0 items-center justify-between sm:h-24">
      <div className="flex items-center">
        <h2 className="text-xl font-bold tracking-wide text-strong">Trading Journal</h2>
      </div>

      <div className="flex items-center">
        <button className="rounded-lg bg-primary/20 px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/30">
          Connect Wallet
        </button>
      </div>
    </header>
  );
}

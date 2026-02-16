import { MaterialIcon } from "../dashboard/material-icon";

export function JournalHeader() {
  return (
    <header className="mb-4 flex shrink-0 items-center justify-between rounded-2xl bg-card-light p-4 shadow-sm">
      <div className="flex items-center space-x-6">
        <h2 className="ml-2 text-xl font-bold uppercase tracking-wider text-strong">Trading Journal</h2>
        <div className="flex items-center rounded-lg border border-gray-200 bg-gray-100 px-3 py-2">
          <MaterialIcon name="calendar_today" className="mr-2 text-sm text-muted" />
          <span className="typo-body-sm text-body">Oct 1 - Oct 31, 2023</span>
          <MaterialIcon name="expand_more" className="ml-2 text-sm text-muted" />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button className="text-on-primary flex items-center rounded-lg bg-primary px-5 py-2 font-semibold shadow-md shadow-primary/20 transition-all hover:bg-primary-hover">
          <MaterialIcon name="add" className="mr-2 text-sm" />
          New Entry
        </button>

        <div className="h-6 w-px bg-gray-300" />

        <div className="flex cursor-pointer items-center space-x-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 transition hover:bg-gray-100">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDLxsx8OAx-aPoJUI6LfTcL8BEs63bbiKdZE1_sZC2wJt9DiB4zZ6BG9zgqm_LSmDdYEVHCbqke7Hdzgi5i22Nh-jAtE9vMokZX0N4UqnxXBNDB05uwldGp16mfJEb3u-bkakm6TyMFAMQ9atjeExohf_ZAsJW9qfQ8A3utrqotUYoIJNZ4MUXBDwjq_nbNDXU5VQCy-GP1yo0IqszVUXxLXG67pme-EpD17Y6PwO20YgQjuvQkR3O5nT9gxg-cVmXQ55zsgJmogeo"
            alt="USD"
            className="h-3 w-5 rounded-sm object-cover shadow-sm"
          />
          <span className="typo-body-sm text-body">USD</span>
          <MaterialIcon name="expand_more" className="text-sm text-muted" />
        </div>

        <button className="rounded-lg bg-primary/20 px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/30">
          Connect Wallet
        </button>

        <button className="relative p-2 text-muted transition hover:text-body">
          <MaterialIcon name="notifications" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-white bg-danger" />
        </button>

        <div className="flex cursor-pointer items-center space-x-2">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBPrc5YIvFenYkLuZluXYSd_GuwENF1SCEJERwahzHE1NXAhWNBW8i6prwcd2LVME3SUE8B6Cjj_q6YDu5iFK-un9nUJlPZRTZ912mbR3DusGETCZ8G095a15eE21xn3RAGqbPCC2Zf9IQpnnswaPxmGTpD5UkMGcsGl3IBOM95urUG9Em4WiUU1bYQNQ3h9L7M1lDKqhf_rRRmptP6w0DaKAsAxzSZGsFtNCMN5JUm5jekp-f-q4S6sOcYjeTplAZkDS_5F305F0M"
            alt="Profile"
            className="h-9 w-9 rounded-full border border-gray-200"
          />
          <MaterialIcon name="expand_more" className="text-muted" />
        </div>
      </div>
    </header>
  );
}

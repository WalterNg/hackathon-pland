import { MaterialIcon } from "./material-icon";

export function Header() {
  return (
    <header className="z-10 flex h-24 shrink-0 items-center justify-between bg-transparent px-8">
      <h1 className="typo-h1 text-strong">Dashboard</h1>
      <div className="flex items-center gap-6">
        <div className="hidden cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm transition hover:bg-gray-50 sm:flex">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAau-yxQd5rkJrvWge60dnuUgpal2_OtbrHGS2gRnbEgQ5LGMmVgFEH1SG5fJ5hhL1izPEqzOn7PZDrkviMxnWFsqQb5JPYzb2xd6YpXPr-QvnWjYmEfEzfEzZgDFHnAhSCCLxOM0PK4JpeFfQLx1xzMDWwqXEb0IxwHeSxNU-5UnSoAk_tux34Inz8_Oi4t9U96IY9pZ_VcjtcB3Om3zCSNTI7prHzUzscMbakTxmbTyJaFVYzwU41tjgyf0OLQzWYL4U5ksWPtFc"
            alt="US Flag"
            className="h-5 w-5 rounded-full object-cover"
          />
          <span className="typo-body-sm text-body">USD</span>
          <MaterialIcon name="expand_more" className="text-sm text-subtle" />
        </div>

        <button className="typo-body-sm text-on-primary rounded-lg bg-primary px-6 py-2.5 shadow-sm transition-colors hover:bg-primary-hover">
          Connect Wallet
        </button>

        <button className="text-muted hover:text-body relative p-2">
          <MaterialIcon name="notifications" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
        </button>

        <div className="flex cursor-pointer items-center gap-2">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC60q1COOuvIREFoJHhaKapvq45TjG__9W7zyqxNJbFO5KOHFsY3KZKhEFQ3RQHYLtsnTo6KjLUmy2EVVAqqznspr3ckuZ5tGMJNKCB3CfZDRPZXq2fFjlHk4zYe3MiBRhrFU4-FUe-F-yWf_wrKdTbXPM5W1hOJ2nrmfRFf9_4B2_u7QBK6ykVrKLv-khwGqqvAMmgYZzVzPw_LhYN0ijxfONa3RqTYkXs9CxWdS8ZvFZBsN2frENxCEbfnnqML80VsvoeZ8nxcVU"
            alt="User Avatar"
            className="h-10 w-10 rounded-full border-2 border-gray-100"
          />
          <MaterialIcon name="expand_more" className="text-subtle" />
        </div>
      </div>
    </header>
  );
}

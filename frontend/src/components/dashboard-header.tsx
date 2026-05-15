import { Wallet } from "lucide-react"

export function DashboardHeader() {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary p-1.5">
            <Wallet className="size-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">PayWallet</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-muted" />
        </div>
      </div>
    </header>
  )
}

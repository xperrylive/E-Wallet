import { mutate } from "swr"
import useSWR from "swr"
import { useState } from "react"
import { fetchWallet, fetchTransactions, createWallet, topupWallet, type Wallet } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Wallet as WalletIcon,
  Send,
  Download,
  AlertCircle,
  TrendingUp,
  Eye,
  EyeOff,
  Plus,
} from "lucide-react"
import { TransactionHistory } from "@/components/transaction-history"
import { ActivitySparkline } from "@/components/activity-sparkline"
import { SendMoneyModal, ReceiveMoneyModal } from "@/components/money-modals"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface WalletDashboardProps {
  token: string
}

function formatCurrency(amount: string, currency: string): string {
  return `${currency} ${parseFloat(amount).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function WalletLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-12 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-4 w-32 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
      <div className="flex gap-4">
        <div className="h-16 flex-1 animate-pulse rounded-lg bg-muted" />
        <div className="h-16 flex-1 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  )
}

function WalletNotFound() {
  const [loading, setLoading] = useState(false)

  const handleCreateWallet = async () => {
    setLoading(true)
    try {
      await createWallet()
      mutate(["wallet", undefined])
    } catch (error: any) {
      alert("Failed to create wallet: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertCircle className="size-8 text-destructive" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">Wallet Not Found</h3>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          We couldn&apos;t find a wallet associated with your account.
          <br />
          Please create a new wallet to continue.
        </p>
        <Button className="mt-6" variant="outline" onClick={handleCreateWallet} disabled={loading}>
          {loading ? "Creating..." : "Create Wallet"}
        </Button>
      </CardContent>
    </Card>
  )
}

function WalletError({ message }: { message: string }) {
  return (
    <Card className="border-destructive/50 bg-card">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertCircle className="size-8 text-destructive" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">Something went wrong</h3>
        <p className="mt-2 text-center text-sm text-muted-foreground">{message}</p>
        <Button className="mt-6" variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </CardContent>
    </Card>
  )
}

function WalletBalance({ wallet, visible, onToggle }: { wallet: Wallet; visible: boolean; onToggle: () => void }) {
  const maskedBalance = `${wallet.currency} •••.••`

  return (
    <Card className="relative overflow-hidden border-border bg-card">
      {/* Decorative orbs */}
      <div className="absolute -right-8 -top-8 size-32 rounded-full bg-primary/5" />
      <div className="absolute -right-4 top-8 size-16 rounded-full bg-primary/10" />

      <CardHeader className="relative pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <WalletIcon className="size-5 text-primary" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground">Available Balance</CardTitle>
          </div>

          {/* Visibility toggle */}
          <button
            id="balance-visibility-toggle"
            onClick={onToggle}
            className="group flex size-8 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={visible ? "Hide balance" : "Show balance"}
          >
            {visible ? (
              <Eye className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
            ) : (
              <EyeOff className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
            )}
          </button>
        </div>
      </CardHeader>

      <CardContent className="relative">
        <div className="flex items-baseline gap-2">
          <span
            className={`text-4xl font-bold tracking-tight text-foreground transition-all duration-300 ${
              !visible ? "select-none blur-sm" : ""
            }`}
          >
            {visible ? formatCurrency(wallet.balance, wallet.currency) : maskedBalance}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            <TrendingUp className="size-3" />
            Active
          </div>
          <span className="text-xs text-muted-foreground">
            Last updated:{" "}
            {new Date(wallet.updated_at).toLocaleDateString("en-MY", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function TopupModal({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)

  const presets = ["10", "50", "100", "500"]

  const handleTopup = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setLoading(true)
    try {
      await topupWallet(amount, "Top-up (testing)")
      setOpen(false)
      setAmount("")
      onSuccess()
      mutate(["wallet", undefined])
      mutate(["transactions", undefined])
    } catch (err: any) {
      alert("Top-up failed: " + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          id="topup-btn"
          variant="outline"
          className="h-12 w-full gap-2 border-dashed border-primary/40 text-primary hover:border-primary hover:bg-primary/5"
        >
          <Plus className="size-4" />
          Top Up Balance (Testing)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Plus className="size-5 text-primary" />
            </div>
            Top Up Balance
          </DialogTitle>
          <DialogDescription>
            Add test funds to your wallet for development purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Quick-amount chips */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Quick Select</Label>
            <div className="grid grid-cols-4 gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className={`rounded-lg border py-2 text-sm font-semibold transition-colors ${
                    amount === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-foreground hover:border-primary/50 hover:bg-primary/5"
                  }`}
                >
                  RM {p}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="space-y-2">
            <Label htmlFor="topup-amount" className="text-sm font-medium text-foreground">
              Or enter custom amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">RM</span>
              <Input
                id="topup-amount"
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 pl-10 text-lg font-medium"
              />
            </div>
          </div>

          <Button
            className="h-12 w-full gap-2 text-base font-medium"
            disabled={!amount || parseFloat(amount) <= 0 || loading}
            onClick={handleTopup}
          >
            {loading ? (
              <><div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Adding funds...</>
            ) : (
              <><Plus className="size-4" /> Add RM {amount || "0.00"}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ActionButtons({ walletId, onTopupSuccess }: { walletId: string; onTopupSuccess: () => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <SendMoneyModal
          trigger={
            <Button id="send-money-btn" className="h-16 flex-col gap-1.5 text-sm font-medium" size="lg">
              <Send className="size-5" />
              Send Money
            </Button>
          }
        />
        <ReceiveMoneyModal
          walletId={walletId}
          trigger={
            <Button id="receive-money-btn" className="h-16 flex-col gap-1.5 text-sm font-medium" variant="secondary" size="lg">
              <Download className="size-5" />
              Receive Money
            </Button>
          }
        />
      </div>
      <TopupModal onSuccess={onTopupSuccess} />
    </div>
  )
}

export function WalletDashboard({ token }: WalletDashboardProps) {
  const [balanceVisible, setBalanceVisible] = useState(true)

  const { data: wallet, error, isLoading } = useSWR(
    token ? ["wallet", token] : null,
    () => fetchWallet(token),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  )

  const { data: txData } = useSWR(
    token && wallet ? ["transactions", token] : null,
    () => fetchTransactions(token),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  )

  if (isLoading) return <WalletLoadingSkeleton />

  if (error) {
    if (error.message === "WALLET_NOT_FOUND") return <WalletNotFound />
    return <WalletError message={`Unable to load wallet. (${error.message})`} />
  }

  if (!wallet) return <WalletNotFound />

  const transactions = txData?.transactions || []

  return (
    <div className="space-y-6">
      <WalletBalance
        wallet={wallet}
        visible={balanceVisible}
        onToggle={() => setBalanceVisible((v) => !v)}
      />
      <ActionButtons
        walletId={wallet.id}
        onTopupSuccess={() => {
          mutate(["wallet", undefined])
          mutate(["transactions", undefined])
        }}
      />
      <ActivitySparkline
        transactions={transactions}
        currentBalance={wallet.balance_cents}
      />
      <TransactionHistory token={token} />
    </div>
  )
}

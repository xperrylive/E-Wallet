"use client"

import { mutate } from "swr"
import useSWR from "swr"
import { useState } from "react"
import { fetchWallet, fetchTransactions, createWallet, type Wallet } from "@/lib/api"
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
} from "lucide-react"
import { TransactionHistory } from "@/components/transaction-history"
import { ActivitySparkline } from "@/components/activity-sparkline"
import { SendMoneyModal, ReceiveMoneyModal } from "@/components/money-modals"

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

function ActionButtons({ walletId }: { walletId: string }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <SendMoneyModal
        trigger={
          <Button
            id="send-money-btn"
            className="h-16 flex-col gap-1.5 text-sm font-medium"
            size="lg"
          >
            <Send className="size-5" />
            Send Money
          </Button>
        }
      />
      <ReceiveMoneyModal
        walletId={walletId}
        trigger={
          <Button
            id="receive-money-btn"
            className="h-16 flex-col gap-1.5 text-sm font-medium"
            variant="secondary"
            size="lg"
          >
            <Download className="size-5" />
            Receive Money
          </Button>
        }
      />
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
      <ActionButtons walletId={wallet.id} />
      <ActivitySparkline
        transactions={transactions}
        currentBalance={wallet.balance_cents}
      />
      <TransactionHistory token={token} />
    </div>
  )
}

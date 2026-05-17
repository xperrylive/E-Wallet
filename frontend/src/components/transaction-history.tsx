"use client"

import useSWR from "swr"
import { fetchTransactions, type Transaction } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle, History, PlusCircle } from "lucide-react"

interface TransactionHistoryProps {
  token: string
}

function formatAmount(amount: string, currency: string): string {
  const value = Math.abs(parseFloat(amount))
  return value.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateString: string): string {
  const d = new Date(dateString)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) {
    return d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })
  }
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })
}

function TransactionLoadingSkeleton() {
  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2 min-w-0">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded bg-muted shrink-0" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function StatusDot({ status }: { status: Transaction["status"] }) {
  const colors = {
    completed: "bg-emerald-500",
    pending: "bg-yellow-500",
    failed: "bg-destructive",
    reversed: "bg-muted-foreground",
  }
  const labels = { completed: "Completed", pending: "Pending", failed: "Failed", reversed: "Reversed" }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className={`inline-block size-1.5 rounded-full ${colors[status] ?? colors.pending}`} />
      {labels[status] ?? "Pending"}
    </span>
  )
}

function DirectionIcon({ type }: { type: Transaction["type"] }) {
  if (type === "topup") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
        <PlusCircle className="size-5 text-emerald-500" />
      </div>
    )
  }
  if (type === "sent") {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
        <ArrowUpRight className="size-5 text-destructive" />
      </div>
    )
  }
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
      <ArrowDownLeft className="size-5 text-primary" />
    </div>
  )
}

function TransactionRow({ transaction }: { transaction: Transaction & { counterparty_display_name?: string } }) {
  const isTopup = transaction.type === "topup"
  const isSent = transaction.type === "sent"

  const amountColor = isTopup ? "text-emerald-500" : isSent ? "text-destructive" : "text-primary"
  const amountPrefix = isTopup ? "+" : isSent ? "−" : "+"
  const currency = transaction.currency ?? "MYR"

  // Counterparty label: name > description > fallback
  const counterpartyName = transaction.counterparty_display_name
  const subLabel = isTopup
    ? "Wallet top-up"
    : counterpartyName && counterpartyName !== "Unknown"
    ? counterpartyName
    : transaction.description || (isSent ? "Sent transfer" : "Received transfer")

  const mainLabel = isTopup ? "Top Up" : isSent ? "Sent" : "Received"

  return (
    <div className="flex items-center gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-muted/30">
      <DirectionIcon type={transaction.type} />

      {/* Name + sub — takes available space, truncates cleanly */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{mainLabel}</p>
        <p className="truncate text-xs text-muted-foreground">{subLabel}</p>
      </div>

      {/* Date — fixed width, right-aligned */}
      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-xs text-muted-foreground">{formatDate(transaction.created_at)}</p>
        <StatusDot status={transaction.status} />
      </div>

      {/* Amount — fixed width, never wraps */}
      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold tabular-nums ${amountColor}`}>
          {amountPrefix}{currency} {formatAmount(transaction.amount, currency)}
        </p>
      </div>
    </div>
  )
}

function EmptyTransactions() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4">
        <History className="size-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">No transactions yet</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Your transaction history will appear here.
      </p>
    </div>
  )
}

export function TransactionHistory({ token }: TransactionHistoryProps) {
  const { data, error, isLoading } = useSWR(
    token ? ["transactions", token] : null,
    () => fetchTransactions(token),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  )

  if (isLoading) return <TransactionLoadingSkeleton />

  if (error) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <History className="size-5 text-muted-foreground" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load transactions.</p>
        </CardContent>
      </Card>
    )
  }

  const transactions = data?.transactions || []

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <History className="size-5 text-muted-foreground" />
          Transaction History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <EmptyTransactions />
        ) : (
          <div className="divide-y divide-border">
            {transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction as any} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

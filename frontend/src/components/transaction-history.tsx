"use client"

import useSWR from "swr"
import { fetchTransactions, type Transaction } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle, History } from "lucide-react"

interface TransactionHistoryProps {
  token: string
}

function formatCurrency(amount: string, currency: string): string {
  const value = parseFloat(amount)
  const formatted = Math.abs(value).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${currency} ${formatted}`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function TransactionLoadingSkeleton() {
  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 animate-pulse rounded-full bg-muted" />
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div className="h-5 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: Transaction["status"] }) {
  const config = {
    completed: {
      icon: CheckCircle2,
      label: "Completed",
      className: "text-primary bg-primary/10",
    },
    pending: {
      icon: Clock,
      label: "Pending",
      className: "text-yellow-500 bg-yellow-500/10",
    },
    failed: {
      icon: XCircle,
      label: "Failed",
      className: "text-destructive bg-destructive/10",
    },
  }

  const { icon: Icon, label, className } = config[status]

  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${className}`}>
      <Icon className="size-3" />
      {label}
    </div>
  )
}

function DirectionIndicator({ type }: { type: Transaction["type"] }) {
  if (type === "sent") {
    return (
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10">
        <ArrowUpRight className="size-5 text-destructive" />
      </div>
    )
  }

  return (
    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
      <ArrowDownLeft className="size-5 text-primary" />
    </div>
  )
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isSent = transaction.type === "sent"

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <DirectionIndicator type={transaction.type} />
          <div>
            <p className="font-medium text-foreground">
              {isSent ? "Sent" : "Received"}
            </p>
            <p className="text-sm text-muted-foreground">
              {transaction.description || "No description"}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <span className="text-sm text-muted-foreground">
          {formatDate(transaction.created_at)}
        </span>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <StatusBadge status={transaction.status} />
      </TableCell>
      <TableCell className="text-right">
        <span className={`font-semibold ${isSent ? "text-destructive" : "text-primary"}`}>
          {isSent ? "-" : "+"}{formatCurrency(transaction.amount, transaction.currency)}
        </span>
      </TableCell>
    </TableRow>
  )
}

function EmptyTransactions() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4">
        <History className="size-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">No transactions yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Your transaction history will appear here once you start sending or receiving money.
      </p>
    </div>
  )
}

export function TransactionHistory({ token }: TransactionHistoryProps) {
  const { data, error, isLoading } = useSWR(
    token ? ["transactions", token] : null,
    () => fetchTransactions(token),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  )

  if (isLoading) {
    return <TransactionLoadingSkeleton />
  }

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
          <p className="text-sm text-muted-foreground">Unable to load transactions. Please try again later.</p>
        </CardContent>
      </Card>
    )
  }

  const transactions = data?.transactions || []

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <History className="size-5 text-muted-foreground" />
          Transaction History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <EmptyTransactions />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TransactionRow key={transaction.id} transaction={transaction} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

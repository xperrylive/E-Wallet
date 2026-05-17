"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { Transaction } from "@/lib/api"

interface ActivitySparklineProps {
  transactions: Transaction[]
  currentBalance: number // in cents
}

interface DayData {
  label: string
  netCents: number
  date: Date
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-14 items-center justify-center">
        <Minus className="size-4 text-muted-foreground" />
      </div>
    )
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const W = 200
  const H = 56
  const PAD = 4

  const coords = points.map((v, i) => {
    const x = PAD + (i / (points.length - 1)) * (W - PAD * 2)
    const y = PAD + ((max - v) / range) * (H - PAD * 2)
    return [x, y] as [number, number]
  })

  // Build smooth SVG path using cubic bezier curves
  const pathD = coords.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`
    const [px, py] = coords[i - 1]
    const cpx = (px + x) / 2
    return `${acc} C ${cpx} ${py} ${cpx} ${y} ${x} ${y}`
  }, "")

  // Area fill path
  const areaD = `${pathD} L ${coords[coords.length - 1][0]} ${H} L ${coords[0][0]} ${H} Z`

  const isUp = points[points.length - 1] >= points[0]
  const strokeColor = isUp ? "var(--color-primary, #22c55e)" : "hsl(var(--destructive))"
  const fillId = `sparkfill-${Math.random().toString(36).slice(2)}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${fillId})`} />
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dot at last point */}
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="3" fill={strokeColor} />
    </svg>
  )
}

export function ActivitySparkline({ transactions, currentBalance }: ActivitySparklineProps) {
  const { days, weekSent, weekReceived, netChange } = useMemo(() => {
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    // Build a map of day → net cents flow
    const dayMap: Record<string, number> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo)
      d.setDate(sevenDaysAgo.getDate() + i)
      dayMap[d.toDateString()] = 0
    }

    let weekSentCents = 0
    let weekReceivedCents = 0

    for (const txn of transactions) {
      const txDate = new Date(txn.created_at)
      if (txDate < sevenDaysAgo) continue
      const key = txDate.toDateString()
      if (!(key in dayMap)) continue

      const cents = Math.abs(txn.amount_cents)
      if (txn.type === "sent") {
        dayMap[key] -= cents
        weekSentCents += cents
      } else {
        dayMap[key] += cents
        weekReceivedCents += cents
      }
    }

    // Convert daily net flows to running balance points
    // Start from currentBalance and walk backwards
    const dayEntries = Object.entries(dayMap)
    const balancePoints: number[] = []
    let runningBalance = currentBalance
    // We'll compute cumulative balance at end of each day
    // (approximate — we reconstruct from current balance backwards)
    const cumulativeFromEnd: number[] = []
    for (let i = dayEntries.length - 1; i >= 0; i--) {
      cumulativeFromEnd.unshift(runningBalance / 100)
      runningBalance -= dayEntries[i][1]
    }
    balancePoints.push(...cumulativeFromEnd)

    const days: DayData[] = dayEntries.map(([dateStr, netCents]) => ({
      label: new Date(dateStr).toLocaleDateString("en-MY", { weekday: "short" }),
      netCents,
      date: new Date(dateStr),
    }))

    const netChange = weekReceivedCents - weekSentCents

    return {
      days,
      weekSent: weekSentCents / 100,
      weekReceived: weekReceivedCents / 100,
      netChange: netChange / 100,
      balancePoints,
    }
  }, [transactions, currentBalance])

  const { balancePoints } = useMemo(() => {
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const dayMap: Record<string, number> = {}
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo)
      d.setDate(sevenDaysAgo.getDate() + i)
      dayMap[d.toDateString()] = 0
    }

    for (const txn of transactions) {
      const txDate = new Date(txn.created_at)
      if (txDate < sevenDaysAgo) continue
      const key = txDate.toDateString()
      if (!(key in dayMap)) continue
      const cents = Math.abs(txn.amount_cents)
      dayMap[key] += txn.type === "sent" ? -cents : cents
    }

    const dayEntries = Object.entries(dayMap)
    let runningBalance = currentBalance
    const cumulativeFromEnd: number[] = []
    for (let i = dayEntries.length - 1; i >= 0; i--) {
      cumulativeFromEnd.unshift(runningBalance / 100)
      runningBalance -= dayEntries[i][1]
    }

    return { balancePoints: cumulativeFromEnd }
  }, [transactions, currentBalance])

  const isPositive = netChange >= 0
  const TrendIcon = netChange === 0 ? Minus : isPositive ? TrendingUp : TrendingDown
  const trendColor = netChange === 0 ? "text-muted-foreground" : isPositive ? "text-primary" : "text-destructive"
  const trendBg = netChange === 0 ? "bg-muted" : isPositive ? "bg-primary/10" : "bg-destructive/10"

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            7-Day Activity
          </p>
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${trendBg} ${trendColor}`}>
            <TrendIcon className="size-3" />
            {netChange === 0 ? "No change" : `${isPositive ? "+" : "-"}RM ${Math.abs(netChange).toFixed(2)}`}
          </div>
        </div>

        {/* Sparkline */}
        <div className="mb-3">
          <Sparkline points={balancePoints} />
        </div>

        {/* Day labels */}
        <div className="mb-4 flex justify-between">
          {days.map((d) => (
            <span key={d.label} className="text-[10px] text-muted-foreground">{d.label}</span>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowUpRight className="size-3 text-destructive" />
              <span className="text-[10px] font-medium uppercase tracking-wide text-destructive/70">Sent</span>
            </div>
            <p className="text-sm font-bold text-destructive">
              RM {weekSent.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowDownLeft className="size-3 text-primary" />
              <span className="text-[10px] font-medium uppercase tracking-wide text-primary/70">Received</span>
            </div>
            <p className="text-sm font-bold text-primary">
              RM {weekReceived.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

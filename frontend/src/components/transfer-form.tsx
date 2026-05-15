"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ArrowRight, Wallet } from "lucide-react"

export function TransferForm() {
  const [recipientId, setRecipientId] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Form submission logic would go here
    console.log({ recipientId, amount, description })
  }

  const isFormValid = recipientId.trim() !== "" && amount.trim() !== ""

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Wallet className="size-5 text-primary" />
          </div>
          <CardTitle className="text-base font-semibold text-foreground">
            Transfer Funds
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label
              htmlFor="recipient-wallet-id"
              className="text-sm font-medium text-foreground"
            >
              Recipient Wallet ID
            </Label>
            <Input
              id="recipient-wallet-id"
              type="text"
              placeholder="Enter wallet ID (e.g., 550e8400-e29b...)"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="h-11 bg-input border-border placeholder:text-muted-foreground/60"
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="amount"
              className="text-sm font-medium text-foreground"
            >
              Amount (MYR)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                MYR
              </span>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 pl-12 bg-input border-border placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="description"
              className="text-sm font-medium text-foreground"
            >
              Description
            </Label>
            <Textarea
              id="description"
              placeholder="What is this transfer for? (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[88px] resize-none bg-input border-border placeholder:text-muted-foreground/60"
            />
          </div>

          <Button
            type="submit"
            disabled={!isFormValid}
            className="w-full h-12 gap-2 text-base font-medium mt-2"
          >
            Continue Transfer
            <ArrowRight className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import { mutate } from "swr"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  ScanLine,
  Upload,
  Check,
  User,
  Banknote,
  CreditCard,
  QrCode,
  ArrowRight,
  Share2,
  X,
  Clock,
  Copy,
} from "lucide-react"
import { transferMoney, generateQR, payQR } from "@/lib/api"
import { v4 as uuidv4 } from "uuid"

// ─── Shared Types ──────────────────────────────────────────────

interface ScannedPayload {
  qr_code_id: string
  merchantName: string
  amountType: "static" | "dynamic"
  amount?: string
  description?: string
}

// ─── Send Money Modal ──────────────────────────────────────────

interface SendMoneyModalProps {
  trigger: React.ReactNode
  walletId?: string
}

function QRSendTab() {
  const [scanned, setScanned] = useState<ScannedPayload | null>(null)
  const [dynamicAmount, setDynamicAmount] = useState("")
  const [isConfirming, setIsConfirming] = useState(false)

  const handleScan = (payload: ScannedPayload) => setScanned(payload)

  const handleConfirm = async () => {
    if (!scanned) return
    setIsConfirming(true)
    try {
      await payQR(
        scanned.qr_code_id,
        scanned.amountType === "dynamic" ? dynamicAmount : null,
        uuidv4()
      )
      alert("Payment successful!")
      mutate(["wallet", undefined])
      mutate(["transactions", undefined])
      setScanned(null)
      setDynamicAmount("")
    } catch (err: any) {
      alert("Payment failed: " + (err.response?.data?.error || err.message || err))
    } finally {
      setIsConfirming(false)
    }
  }

  if (scanned) {
    const isStatic = scanned.amountType === "static"
    const canConfirm = isStatic || parseFloat(dynamicAmount) > 0
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Check className="size-8 text-primary" />
          </div>
          <p className="mt-3 text-sm font-medium text-muted-foreground">QR Code Scanned</p>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
              <User className="size-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recipient</p>
              <p className="mt-0.5 text-lg font-semibold text-foreground">{scanned.merchantName}</p>
            </div>
          </div>
          {scanned.description && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">{scanned.description}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Banknote className="size-4 text-muted-foreground" />
            Amount (MYR)
          </Label>
          {isStatic ? (
            <div className="flex h-14 items-center rounded-lg border border-border bg-muted/50 px-4">
              <span className="text-sm font-medium text-muted-foreground">MYR</span>
              <span className="ml-3 text-2xl font-bold text-foreground">
                {parseFloat(scanned.amount || "0").toFixed(2)}
              </span>
              <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">Fixed</span>
            </div>
          ) : (
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">MYR</span>
              <Input
                type="number"
                placeholder="0.00"
                min="0.01"
                step="0.01"
                value={dynamicAmount}
                onChange={(e) => setDynamicAmount(e.target.value)}
                className="h-14 pl-14 text-2xl font-bold"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="h-12 flex-1" onClick={() => setScanned(null)}>
            Back
          </Button>
          <Button
            className="h-12 flex-1 gap-2"
            disabled={!canConfirm || isConfirming}
            onClick={handleConfirm}
          >
            {isConfirming ? (
              <><div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Processing...</>
            ) : (
              <><Check className="size-4" /> Confirm Pay</>
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* QR viewfinder */}
      <div
        className="relative mx-auto aspect-square w-full max-w-64 cursor-pointer overflow-hidden rounded-2xl bg-zinc-900"
        onClick={() => handleScan({ qr_code_id: "QR-MOCK-DYNAMIC", merchantName: "Ahmad bin Abdullah", amountType: "dynamic", description: "Personal transfer" })}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleScan({ qr_code_id: "QR-MOCK-DYNAMIC", merchantName: "Ahmad bin Abdullah", amountType: "dynamic", description: "Personal transfer" })}
        aria-label="Tap to simulate scan"
      >
        <div className="absolute left-4 top-4 h-7 w-7 rounded-tl-lg border-l-2 border-t-2 border-primary" />
        <div className="absolute right-4 top-4 h-7 w-7 rounded-tr-lg border-r-2 border-t-2 border-primary" />
        <div className="absolute bottom-4 left-4 h-7 w-7 rounded-bl-lg border-b-2 border-l-2 border-primary" />
        <div className="absolute bottom-4 right-4 h-7 w-7 rounded-br-lg border-b-2 border-r-2 border-primary" />
        <div className="absolute inset-x-6 animate-scan">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <ScanLine className="size-10 text-primary/60" />
          <p className="mt-3 text-sm font-medium text-zinc-400">Position QR code here</p>
          <p className="mt-1 text-xs text-zinc-500">Tap to simulate scan</p>
        </div>
      </div>

      <Input
        placeholder="Or paste QR Code ID here..."
        onChange={(e) => {
          if (e.target.value.length > 5) {
            let qrId = e.target.value
            let amountStr: string | undefined
            let type: "static" | "dynamic" = "dynamic"
            if (qrId.includes("qr_id=")) {
              try {
                const url = new URL(qrId)
                qrId = url.searchParams.get("qr_id") || qrId
                const amt = url.searchParams.get("amount")
                if (amt && amt !== "0") { amountStr = (parseInt(amt) / 100).toFixed(2); type = "static" }
              } catch {}
            }
            handleScan({ qr_code_id: qrId, merchantName: "Test Merchant", amountType: type, amount: amountStr, description: "Scanned Payment" })
          }
        }}
      />

      <Button
        variant="secondary"
        className="h-11 w-full gap-2"
        onClick={() => handleScan({ qr_code_id: "QR-TEST", merchantName: "Coffee Corner Sdn Bhd", amountType: "static", amount: "15.90", description: "Order #1234" })}
      >
        <Upload className="size-4" />
        Upload QR from Gallery
      </Button>
    </div>
  )
}

function AccountSendTab() {
  const [recipientId, setRecipientId] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await transferMoney(recipientId.trim(), amount, description, uuidv4())
      setRecipientId("")
      setAmount("")
      setDescription("")
      alert("Transfer successful!")
      mutate(["wallet", undefined])
      mutate(["transactions", undefined])
    } catch (err: any) {
      alert("Transfer failed: " + (err.response?.data?.error || err.message || err))
    } finally {
      setLoading(false)
    }
  }

  const isValid = recipientId.trim() !== "" && parseFloat(amount) > 0 && !loading

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="send-wallet-id" className="text-sm font-medium text-foreground">
          Recipient Wallet ID
        </Label>
        <Input
          id="send-wallet-id"
          type="text"
          placeholder="Enter wallet ID (e.g. 550e8400-e29b...)"
          value={recipientId}
          onChange={(e) => setRecipientId(e.target.value)}
          className="h-11 bg-input border-border font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="send-amount" className="text-sm font-medium text-foreground">Amount (MYR)</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">MYR</span>
          <Input
            id="send-amount"
            type="number"
            placeholder="0.00"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 pl-12 bg-input border-border"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="send-description" className="text-sm font-medium text-foreground">
          Description <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="send-description"
          placeholder="What is this for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-20 resize-none bg-input border-border"
        />
      </div>

      <Button type="submit" disabled={!isValid} className="h-12 w-full gap-2 text-base font-medium">
        {loading ? (
          <><div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Sending...</>
        ) : (
          <>Send Money <ArrowRight className="size-4" /></>
        )}
      </Button>
    </form>
  )
}

export function SendMoneyModal({ trigger }: SendMoneyModalProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"qr" | "account">("qr")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <ScanLine className="size-5 text-primary" />
            </div>
            Send Money
          </DialogTitle>
          <DialogDescription>Choose how you want to send money.</DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <ToggleGroup
          type="single"
          value={tab}
          onValueChange={(v) => v && setTab(v as "qr" | "account")}
          className="grid grid-cols-2 gap-2"
        >
          <ToggleGroupItem
            value="qr"
            className="h-11 gap-2 border border-border data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            <QrCode className="size-4" />
            Scan QR
          </ToggleGroupItem>
          <ToggleGroupItem
            value="account"
            className="h-11 gap-2 border border-border data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            <CreditCard className="size-4" />
            Wallet ID
          </ToggleGroupItem>
        </ToggleGroup>

        {tab === "qr" ? <QRSendTab /> : <AccountSendTab />}
      </DialogContent>
    </Dialog>
  )
}

// ─── Receive Money Modal ───────────────────────────────────────

interface ReceiveMoneyModalProps {
  trigger: React.ReactNode
  walletId?: string
}

type QRType = "static" | "dynamic"
type ExpirationOption = "15min" | "1hour" | "24hours"

interface QRFormData {
  qrType: QRType
  amount: string
  description: string
  expiration: ExpirationOption
}

function QRReceiveTab() {
  const [showSuccess, setShowSuccess] = useState(false)
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<QRFormData>({
    qrType: "static",
    amount: "",
    description: "",
    expiration: "15min",
  })

  const isStaticAmount = formData.qrType === "static"
  const canGenerate = formData.qrType === "dynamic" || (isStaticAmount && parseFloat(formData.amount) > 0)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      let minutes = 15
      if (formData.expiration === "1hour") minutes = 60
      if (formData.expiration === "24hours") minutes = 1440
      const res = await generateQR(
        formData.qrType === "static" ? formData.amount : null,
        formData.qrType,
        formData.description,
        minutes
      )
      setQrImageUrl(res.qr_image_url)
      setShowSuccess(true)
    } catch (err: any) {
      alert("Failed to generate QR: " + (err.response?.data?.error || err.message || err))
    } finally {
      setLoading(false)
    }
  }

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center space-y-6">
        <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
          {qrImageUrl ? (
            <img src={qrImageUrl} alt="QR Code" className="size-48" />
          ) : (
            <div className="flex size-48 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50">
              <QrCode className="size-12 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {formData.qrType === "static" ? (
              <>Amount: <span className="font-semibold text-foreground">MYR {parseFloat(formData.amount).toFixed(2)}</span></>
            ) : (
              <span className="font-medium text-foreground">Dynamic Amount</span>
            )}
          </p>
          {formData.description && <p className="mt-1 text-sm text-muted-foreground">{formData.description}</p>}
          <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            Expires in {formData.expiration === "15min" ? "15 minutes" : formData.expiration === "1hour" ? "1 hour" : "24 hours"}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-3">
          <Button variant="secondary" className="h-12 gap-2" onClick={async () => {
            if (navigator.share) { try { await navigator.share({ title: "Payment QR Code", text: formData.description || "Scan to pay" }) } catch {} }
          }}>
            <Share2 className="size-4" /> Share
          </Button>
          <Button variant="outline" className="h-12 gap-2" onClick={() => { setShowSuccess(false); setQrImageUrl(null) }}>
            <X className="size-4" /> New QR
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">QR Type</Label>
        <ToggleGroup
          type="single"
          value={formData.qrType}
          onValueChange={(v) => v && setFormData({ ...formData, qrType: v as QRType })}
          className="grid grid-cols-2 gap-2"
        >
          <ToggleGroupItem value="static" className="h-11 gap-2 border border-border data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
            <Check className="size-4" /> Fixed Amount
          </ToggleGroupItem>
          <ToggleGroupItem value="dynamic" className="h-11 gap-2 border border-border data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
            <QrCode className="size-4" /> Any Amount
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          {isStaticAmount ? "Set a fixed amount for the payment." : "Payer enters the amount when scanning."}
        </p>
      </div>

      {isStaticAmount && (
        <div className="space-y-2">
          <Label htmlFor="receive-amount" className="text-sm font-medium text-foreground">Amount (MYR)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">MYR</span>
            <Input
              id="receive-amount"
              type="number"
              placeholder="0.00"
              min="0.01"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="h-12 pl-12 text-lg font-medium"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="receive-description" className="text-sm font-medium text-foreground">
          Description <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="receive-description"
          placeholder="Payment for..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="min-h-20 resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="receive-expiration" className="text-sm font-medium text-foreground">Expiration</Label>
        <Select value={formData.expiration} onValueChange={(v) => setFormData({ ...formData, expiration: v as ExpirationOption })}>
          <SelectTrigger id="receive-expiration" className="h-11">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15min">15 minutes</SelectItem>
            <SelectItem value="1hour">1 hour</SelectItem>
            <SelectItem value="24hours">24 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleGenerate} disabled={!canGenerate || loading} className="h-12 w-full gap-2 text-base font-medium">
        <QrCode className="size-5" />
        {loading ? "Generating..." : "Generate QR Code"}
      </Button>
    </div>
  )
}

function WalletIdTab({ walletId }: { walletId?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!walletId) return
    await navigator.clipboard.writeText(walletId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <CreditCard className="size-8 text-primary" />
        </div>
        <p className="mt-3 text-sm font-medium text-foreground">Your Wallet ID</p>
        <p className="mt-1 text-xs text-muted-foreground">Share this ID so others can send you money directly.</p>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="break-all font-mono text-sm font-medium text-foreground">
          {walletId || "Loading..."}
        </p>
      </div>

      <Button
        className="h-12 w-full gap-2 text-base font-medium"
        variant={copied ? "secondary" : "default"}
        onClick={handleCopy}
        disabled={!walletId}
      >
        {copied ? (
          <><Check className="size-4" /> Copied!</>
        ) : (
          <><Copy className="size-4" /> Copy Wallet ID</>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Only share your Wallet ID with trusted senders.
      </p>
    </div>
  )
}

export function ReceiveMoneyModal({ trigger, walletId }: ReceiveMoneyModalProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"qr" | "id">("qr")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <QrCode className="size-5 text-primary" />
            </div>
            Receive Money
          </DialogTitle>
          <DialogDescription>Choose how you want to receive money.</DialogDescription>
        </DialogHeader>

        {/* Tab switcher */}
        <ToggleGroup
          type="single"
          value={tab}
          onValueChange={(v) => v && setTab(v as "qr" | "id")}
          className="grid grid-cols-2 gap-2"
        >
          <ToggleGroupItem
            value="qr"
            className="h-11 gap-2 border border-border data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            <QrCode className="size-4" />
            Generate QR
          </ToggleGroupItem>
          <ToggleGroupItem
            value="id"
            className="h-11 gap-2 border border-border data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            <CreditCard className="size-4" />
            Wallet ID
          </ToggleGroupItem>
        </ToggleGroup>

        {tab === "qr" ? <QRReceiveTab /> : <WalletIdTab walletId={walletId} />}
      </DialogContent>
    </Dialog>
  )
}

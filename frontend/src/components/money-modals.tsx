"use client"

import { useState, useEffect } from "react"
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
  Loader2,
} from "lucide-react"
import { transferMoney, generateQR, payQR, lookupWallet, lookupQRInfo, fetchPermanentQR } from "@/lib/api"
import { v4 as uuidv4 } from "uuid"
import { useToast } from "@/components/toast"

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
  token?: string
}

function QRSendTab({ token }: { token?: string }) {
  const [scanned, setScanned] = useState<ScannedPayload | null>(null)
  const [dynamicAmount, setDynamicAmount] = useState("")
  const [isConfirming, setIsConfirming] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const { success, error: toastError } = useToast()

  const resolveAndScan = async (qrId: string) => {
    setIsLookingUp(true)
    try {
      const info = await lookupQRInfo(qrId)
      setScanned({
        qr_code_id: info.qr_code_id,
        merchantName: info.merchant_name,
        amountType: info.qr_type,
        amount: info.amount ?? undefined,
        description: info.description,
      })
    } catch (err: any) {
      toastError("Invalid QR Code", err.response?.data?.error || "QR code not found or expired")
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleConfirm = async () => {
    if (!scanned) return
    setIsConfirming(true)
    try {
      await payQR(scanned.qr_code_id, scanned.amountType === "dynamic" ? dynamicAmount : null, uuidv4())
      success("Payment Sent!", `Successfully paid ${scanned.merchantName}`)
      mutate(["wallet", token])
      mutate(["transactions", token])
      setScanned(null)
      setDynamicAmount("")
    } catch (err: any) {
      toastError("Payment Failed", err.message || "Unknown error")
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

  if (isLookingUp) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Looking up recipient...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* QR viewfinder */}
      <div
        className="relative mx-auto aspect-square w-full max-w-64 overflow-hidden rounded-2xl bg-zinc-900"
        role="img"
        aria-label="Paste QR link below to pay"
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
        </div>
      </div>

      {/* Paste input — resolves real name via API */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Paste QR Code / payment link</p>
        <Input
          placeholder="ewallet://pay?qr_id=QR-20250517-ABC123"
          className="font-mono text-xs"
          onBlur={async (e) => {
            const raw = e.target.value.trim()
            if (!raw || raw.length < 5) return
            let qrId = raw
            if (raw.startsWith("ewallet://")) {
              try {
                const url = new URL(raw.replace("ewallet://", "https://ewallet/"))
                qrId = url.searchParams.get("qr_id") || raw
              } catch {}
            }
            await resolveAndScan(qrId)
          }}
        />
      </div>

      {/* Upload from gallery — real QR decoding with jsQR */}
      <label className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80">
        <Upload className="size-4" />
        Upload QR from Gallery
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              const img = new Image()
              img.src = URL.createObjectURL(file)
              await new Promise((res) => { img.onload = res })
              const canvas = document.createElement("canvas")
              canvas.width = img.width
              canvas.height = img.height
              const ctx = canvas.getContext("2d")!
              ctx.drawImage(img, 0, 0)
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
              // Dynamically import jsQR
              const { default: jsQR } = await import("jsqr")
              const result = jsQR(imageData.data, imageData.width, imageData.height)
              if (!result) { toastError("No QR Found", "Make sure the QR code is clear and well-lit."); return }
              let qrId = result.data
              if (result.data.startsWith("ewallet://")) {
                try {
                  const url = new URL(result.data.replace("ewallet://", "https://ewallet/"))
                  qrId = url.searchParams.get("qr_id") || result.data
                } catch {}
              }
              await resolveAndScan(qrId)
            } catch {
              toastError("Scan Failed", "Could not read QR code from this image.")
            }
          }}
        />
      </label>
    </div>
  )
}

function AccountSendTab({ token }: { token?: string }) {
  const [recipientId, setRecipientId] = useState("")
  const [recipientName, setRecipientName] = useState<string | null>(null)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const { success, error: toastError } = useToast()

  const handleWalletBlur = async () => {
    const id = recipientId.trim()
    if (id.length < 10) { setRecipientName(null); return }
    setIsLookingUp(true)
    try {
      const info = await lookupWallet(id)
      setRecipientName(info.display_name)
    } catch {
      setRecipientName(null)
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await transferMoney(recipientId.trim(), amount, description, uuidv4())
      const name = recipientName || "recipient"
      setRecipientId(""); setRecipientName(null); setAmount(""); setDescription("")
      success("Transfer Successful!", `Sent MYR ${amount} to ${name}`)
      mutate(["wallet", token])
      mutate(["transactions", token])
    } catch (err: any) {
      toastError("Transfer Failed", err.message || "Unknown error")
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
        {recipientName && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
            <User className="size-4 text-primary" />
            <span className="text-sm font-medium text-primary">{recipientName}</span>
          </div>
        )}
        <div className="relative">
        <Input
          id="send-wallet-id"
          type="text"
          placeholder="Enter wallet ID (e.g. 550e8400-e29b...)"
          value={recipientId}
          onChange={(e) => { setRecipientId(e.target.value); setRecipientName(null) }}
          onBlur={handleWalletBlur}
          className="h-11 bg-input border-border font-mono text-sm pr-8"
        />
        {isLookingUp && <Loader2 className="absolute right-2 top-3 size-4 animate-spin text-muted-foreground" />}
        </div>
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

export function SendMoneyModal({ trigger, token }: SendMoneyModalProps) {
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

        {tab === "qr" ? <QRSendTab token={token} /> : <AccountSendTab token={token} />}
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
  const [subTab, setSubTab] = useState<"permanent" | "custom">("permanent")
  
  // Permanent QR State
  const [permanentQr, setPermanentQr] = useState<{
    qr_code_id: string
    qr_image_url: string
    qr_data: string
  } | null>(null)
  const [permLoading, setPermLoading] = useState(false)
  const [permCopied, setPermCopied] = useState(false)

  // Custom QR state
  const [showSuccess, setShowSuccess] = useState(false)
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [qrDataString, setQrDataString] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const { error: toastError } = useToast()
  
  const [formData, setFormData] = useState<QRFormData>({
    qrType: "static",
    amount: "",
    description: "",
    expiration: "15min",
  })

  // Fetch permanent QR code
  useEffect(() => {
    if (subTab === "permanent" && !permanentQr) {
      setPermLoading(true)
      fetchPermanentQR()
        .then((res) => {
          setPermanentQr(res)
        })
        .catch((err) => {
          toastError("Failed to load permanent QR", err.message || "Unknown error")
        })
        .finally(() => {
          setPermLoading(false)
        })
    }
  }, [subTab, permanentQr])

  const handleCopyPermData = async () => {
    if (!permanentQr) return
    await navigator.clipboard.writeText(permanentQr.qr_data)
    setPermCopied(true)
    setTimeout(() => setPermCopied(false), 2000)
  }

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
      setQrDataString(res.qr_data || "")
      setShowSuccess(true)
    } catch (err: any) {
      toastError("QR Generation Failed", err.response?.data?.error || err.message || "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  const handleCopyData = async () => {
    await navigator.clipboard.writeText(qrDataString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderPermanentTab = () => {
    if (permLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading permanent QR code...</p>
        </div>
      )
    }

    if (!permanentQr) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">Could not load permanent QR code.</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center space-y-5">
        <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
          <img src={permanentQr.qr_image_url} alt="Permanent QR Code" className="size-48" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Your Permanent QR Code</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-72">
            This QR code never expires. Anyone can scan it to send any amount of money to this account.
          </p>
        </div>

        {permanentQr.qr_data && (
          <div className="w-full rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary/70">
              📋 Copy for Account B to pay (testing)
            </p>
            <p className="mb-2 break-all font-mono text-xs text-foreground">{permanentQr.qr_data}</p>
            <button
              onClick={handleCopyPermData}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary/10 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              {permCopied ? <><Check className="size-3" /> Copied!</> : <><Copy className="size-3" /> Copy QR Data</>}
            </button>
          </div>
        )}

        <div className="w-full">
          <Button variant="secondary" className="h-11 w-full gap-2" onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ title: "My Permanent E-Wallet QR Code", text: permanentQr.qr_data })
              } catch {}
            }
          }}>
            <Share2 className="size-4" /> Share QR Code
          </Button>
        </div>
      </div>
    )
  }

  const renderCustomTab = () => {
    if (showSuccess) {
      return (
        <div className="flex flex-col items-center space-y-5">
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

          {/* QR Data string — for testing between two accounts */}
          {qrDataString && (
            <div className="w-full rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary/70">
                📋 Copy for Account B to pay (testing)
              </p>
              <p className="mb-2 break-all font-mono text-xs text-foreground">{qrDataString}</p>
              <button
                onClick={handleCopyData}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary/10 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                {copied ? <><Check className="size-3" /> Copied!</> : <><Copy className="size-3" /> Copy QR Data</>}
              </button>
            </div>
          )}

          <div className="grid w-full grid-cols-2 gap-3">
            <Button variant="secondary" className="h-11 gap-2" onClick={async () => {
              if (navigator.share) { try { await navigator.share({ title: "Payment QR Code", text: qrDataString }) } catch {} }
            }}>
              <Share2 className="size-4" /> Share
            </Button>
            <Button variant="outline" className="h-11 gap-2" onClick={() => { setShowSuccess(false); setQrImageUrl(null); setQrDataString("") }}>
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

  return (
    <div className="space-y-5">
      <ToggleGroup
        type="single"
        value={subTab}
        onValueChange={(v) => v && setSubTab(v as "permanent" | "custom")}
        className="grid grid-cols-2 gap-2 border-b border-border pb-3"
      >
        <ToggleGroupItem
          value="permanent"
          className="h-9 gap-1.5 text-xs border border-border data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
        >
          Permanent QR
        </ToggleGroupItem>
        <ToggleGroupItem
          value="custom"
          className="h-9 gap-1.5 text-xs border border-border data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
        >
          Custom QR
        </ToggleGroupItem>
      </ToggleGroup>

      {subTab === "permanent" ? renderPermanentTab() : renderCustomTab()}
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

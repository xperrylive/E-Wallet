"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { QrCode, Share2, X, Check, Clock } from "lucide-react"

interface QRGeneratorProps {
  trigger: React.ReactNode
}

type QRType = "static" | "dynamic"
type ExpirationOption = "15min" | "1hour" | "24hours"

interface QRFormData {
  qrType: QRType
  amount: string
  description: string
  expiration: ExpirationOption
}

function QRCodePlaceholder() {
  return (
    <div className="flex size-48 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/50">
      <div className="grid grid-cols-5 grid-rows-5 gap-1 p-4">
        {Array.from({ length: 25 }).map((_, i) => (
          <div
            key={i}
            className={`size-4 rounded-sm ${[0, 1, 2, 4, 5, 6, 10, 12, 14, 18, 19, 20, 22, 23, 24].includes(i)
                ? "bg-foreground"
                : "bg-transparent"
              }`}
          />
        ))}
      </div>
    </div>
  )
}

function QRFormView({
  formData,
  setFormData,
  onGenerate,
  loading,
}: {
  formData: QRFormData
  setFormData: (data: QRFormData) => void
  onGenerate: () => void
  loading: boolean
}) {
  const isStaticAmount = formData.qrType === "static"
  const canGenerate = formData.qrType === "dynamic" || (isStaticAmount && parseFloat(formData.amount) > 0)

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">QR Type</Label>
        <ToggleGroup
          type="single"
          value={formData.qrType}
          onValueChange={(value) => {
            if (value) {
              setFormData({ ...formData, qrType: value as QRType })
            }
          }}
          className="grid grid-cols-2 gap-2"
        >
          <ToggleGroupItem
            value="static"
            className="h-12 gap-2 border border-border data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            <Check className="size-4" />
            Static Amount
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dynamic"
            className="h-12 gap-2 border border-border data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            <QrCode className="size-4" />
            Dynamic Amount
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          {isStaticAmount
            ? "Set a fixed amount for the payment request."
            : "Payer enters their own amount when scanning."}
        </p>
      </div>

      {isStaticAmount && (
        <div className="space-y-2">
          <Label htmlFor="qr-amount" className="text-sm font-medium text-foreground">
            Amount (MYR)
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
              MYR
            </span>
            <Input
              id="qr-amount"
              type="number"
              placeholder="0.00"
              min="0.01"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="h-12 pl-14 text-lg font-medium"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="qr-description" className="text-sm font-medium text-foreground">
          Description
          <span className="ml-1 text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="qr-description"
          placeholder="Payment for..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="min-h-20 resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="qr-expiration" className="text-sm font-medium text-foreground">
          Expiration
        </Label>
        <Select
          value={formData.expiration}
          onValueChange={(value) => setFormData({ ...formData, expiration: value as ExpirationOption })}
        >
          <SelectTrigger id="qr-expiration" className="h-12">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <SelectValue placeholder="Select expiration" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15min">15 minutes</SelectItem>
            <SelectItem value="1hour">1 hour</SelectItem>
            <SelectItem value="24hours">24 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={onGenerate}
        disabled={!canGenerate || loading}
        className="h-12 w-full text-base font-medium"
      >
        <QrCode className="mr-2 size-5" />
        {loading ? "Generating..." : "Generate Code"}
      </Button>
    </div>
  )
}

function QRSuccessView({
  formData,
  qrImageUrl,
  onClose,
}: {
  formData: QRFormData
  qrImageUrl: string | null
  onClose: () => void
}) {
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Payment QR Code",
          text: formData.description || "Scan to pay",
        })
      } catch {
        // User cancelled or share failed
      }
    }
  }

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
        {qrImageUrl ? (
          <img src={qrImageUrl} alt="QR Code" className="size-48" />
        ) : (
          <QRCodePlaceholder />
        )}
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {formData.qrType === "static" ? (
            <>
              Amount: <span className="font-semibold text-foreground">MYR {parseFloat(formData.amount).toFixed(2)}</span>
            </>
          ) : (
            <span className="font-medium text-foreground">Dynamic Amount</span>
          )}
        </p>
        {formData.description && (
          <p className="mt-1 text-sm text-muted-foreground">{formData.description}</p>
        )}
        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          Expires in{" "}
          {formData.expiration === "15min"
            ? "15 minutes"
            : formData.expiration === "1hour"
              ? "1 hour"
              : "24 hours"}
        </p>
      </div>

      <div className="grid w-full grid-cols-2 gap-3">
        <Button variant="secondary" onClick={handleShare} className="h-12 gap-2">
          <Share2 className="size-4" />
          Share
        </Button>
        <Button variant="outline" onClick={onClose} className="h-12 gap-2">
          <X className="size-4" />
          Close
        </Button>
      </div>
    </div>
  )
}

export function QRGenerator({ trigger }: QRGeneratorProps) {
  const [open, setOpen] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState < QRFormData > ({
    qrType: "static",
    amount: "",
    description: "",
    expiration: "15min",
  })

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const { generateQR } = await import("@/lib/api")
      let minutes = 15;
      if (formData.expiration === "1hour") minutes = 60;
      if (formData.expiration === "24hours") minutes = 1440;

      const res = await generateQR(
        formData.qrType === "static" ? formData.amount : null,
        formData.qrType,
        formData.description,
        minutes
      )
      setQrImageUrl(res.qr_image_url)
      setShowSuccess(true)
    } catch (err: any) {
      alert("Failed to generate QR: " + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    // Reset state after close animation
    setTimeout(() => {
      setShowSuccess(false)
      setQrImageUrl(null)
      setFormData({
        qrType: "static",
        amount: "",
        description: "",
        expiration: "15min",
      })
    }, 150)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose()
      } else {
        setOpen(true)
      }
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <QrCode className="size-5 text-primary" />
            </div>
            {showSuccess ? "QR Code Ready" : "Generate QR Code"}
          </DialogTitle>
          <DialogDescription>
            {showSuccess
              ? "Share this QR code to receive payments."
              : "Create a QR code for receiving payments."}
          </DialogDescription>
        </DialogHeader>

        {showSuccess ? (
          <QRSuccessView formData={formData} qrImageUrl={qrImageUrl} onClose={handleClose} />
        ) : (
          <QRFormView
            formData={formData}
            setFormData={setFormData}
            onGenerate={handleGenerate}
            loading={loading}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
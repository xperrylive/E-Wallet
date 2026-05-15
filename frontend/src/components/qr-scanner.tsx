"use client"

import { useState, useEffect } from "react"
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
import { ScanLine, Upload, Check, User, Banknote } from "lucide-react"

interface QRScannerProps {
  trigger: React.ReactNode
}

interface ScannedPayload {
  qr_code_id: string
  merchantName: string
  amountType: "static" | "dynamic"
  amount?: string
  description?: string
}

function ScannerViewfinder({ onScan }: { onScan: (payload: ScannedPayload) => void }) {
  return (
    <div className="space-y-4">
      <div
        className="relative mx-auto aspect-square w-full max-w-72 cursor-pointer overflow-hidden rounded-2xl bg-zinc-900"
        onClick={() => onScan({
          qr_code_id: "QR-MOCK-DYNAMIC",
          merchantName: "Ahmad bin Abdullah",
          amountType: "dynamic",
          description: "Personal transfer",
        })}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onScan({
              qr_code_id: "QR-MOCK-DYNAMIC",
              merchantName: "Ahmad bin Abdullah",
              amountType: "dynamic",
              description: "Personal transfer",
            })
          }
        }}
        aria-label="Tap to simulate scan"
      >
        {/* Corner brackets */}
        <div className="absolute left-4 top-4 h-8 w-8 border-l-3 border-t-3 border-primary rounded-tl-lg" />
        <div className="absolute right-4 top-4 h-8 w-8 border-r-3 border-t-3 border-primary rounded-tr-lg" />
        <div className="absolute bottom-4 left-4 h-8 w-8 border-b-3 border-l-3 border-primary rounded-bl-lg" />
        <div className="absolute bottom-4 right-4 h-8 w-8 border-b-3 border-r-3 border-primary rounded-br-lg" />

        {/* Animated scanning line */}
        <div className="absolute inset-x-6 animate-scan">
          <div className="h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
        </div>

        {/* Center hint text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <ScanLine className="size-10 text-primary/60" />
          <p className="mt-3 text-sm font-medium text-zinc-400">
            Position QR code here
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Tap to simulate scan
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input 
          placeholder="Paste QR Code ID here for testing..." 
          onChange={(e) => {
            if (e.target.value.length > 10) {
              // Parse URL if it's the full data URL, e.g. ewallet://pay?qr_id=QR-XYZ&amount=2500
              let qrId = e.target.value;
              let amountStr = undefined;
              let type = "dynamic";
              if (qrId.includes("qr_id=")) {
                const url = new URL(qrId);
                qrId = url.searchParams.get("qr_id") || qrId;
                const amt = url.searchParams.get("amount");
                if (amt && amt !== "0") {
                   amountStr = (parseInt(amt) / 100).toFixed(2);
                   type = "static";
                }
              }
              onScan({
                qr_code_id: qrId,
                merchantName: "Test Merchant",
                amountType: type as any,
                amount: amountStr,
                description: "Scanned Payment"
              });
            }
          }}
        />
      </div>

      <Button
        variant="secondary"
        className="h-12 w-full gap-2"
        onClick={() => {
          onScan({
            qr_code_id: "QR-TEST",
            merchantName: "Coffee Corner Sdn Bhd",
            amountType: "static",
            amount: "15.90",
            description: "Order #1234 - Iced Latte",
          })
        }}
      >
        <Upload className="size-4" />
        Upload QR image from gallery
      </Button>
    </div>
  )
}

function PaymentConfirmationView({
  payload,
  amount,
  setAmount,
  onConfirm,
  isConfirming,
}: {
  payload: ScannedPayload
  amount: string
  setAmount: (amount: string) => void
  onConfirm: () => void
  isConfirming: boolean
}) {
  const isStatic = payload.amountType === "static"
  const displayAmount = isStatic ? payload.amount || "0.00" : amount
  const canConfirm = isStatic || (parseFloat(amount) > 0)

  return (
    <div className="space-y-6">
      {/* Success indicator */}
      <div className="flex flex-col items-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Check className="size-8 text-primary" />
        </div>
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          QR Code Scanned Successfully
        </p>
      </div>

      {/* Merchant info card */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
            <User className="size-6 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Merchant / Recipient
            </p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">
              {payload.merchantName}
            </p>
          </div>
        </div>

        {payload.description && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">{payload.description}</p>
          </div>
        )}
      </div>

      {/* Amount section */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Banknote className="size-4 text-muted-foreground" />
          Amount (MYR)
        </Label>

        {isStatic ? (
          <div className="flex h-14 items-center rounded-lg border border-border bg-muted/50 px-4">
            <span className="text-sm font-medium text-muted-foreground">MYR</span>
            <span className="ml-3 text-2xl font-bold text-foreground">
              {parseFloat(displayAmount).toLocaleString("en-MY", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Fixed
            </span>
          </div>
        ) : (
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
              MYR
            </span>
            <Input
              type="number"
              placeholder="0.00"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-14 pl-14 text-2xl font-bold"
              autoFocus
            />
          </div>
        )}
      </div>

      <Button
        onClick={onConfirm}
        disabled={!canConfirm || isConfirming}
        className="h-14 w-full text-base font-semibold"
      >
        {isConfirming ? (
          <>
            <div className="mr-2 size-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            Processing...
          </>
        ) : (
          <>
            <Check className="mr-2 size-5" />
            Confirm Payment
          </>
        )}
      </Button>
    </div>
  )
}

export function QRScanner({ trigger }: QRScannerProps) {
  const [open, setOpen] = useState(false)
  const [scannedPayload, setScannedPayload] = useState < ScannedPayload | null > (null)
  const [dynamicAmount, setDynamicAmount] = useState("")
  const [isConfirming, setIsConfirming] = useState(false)
  const [scanType, setScanType] = useState < "static" | "dynamic" > ("static")

  // Alternate between static and dynamic scans for demo purposes
  useEffect(() => {
    if (open) {
      setScanType((prev) => (prev === "static" ? "dynamic" : "static"))
    }
  }, [open])

  const handleScan = (payload: ScannedPayload) => {
    setScannedPayload(payload)
  }

  const handleConfirm = async () => {
    if (!scannedPayload) return
    setIsConfirming(true)
    try {
      const { payQR } = await import("@/lib/api")
      const { v4: uuidv4 } = await import("uuid")
      const { mutate } = await import("swr")

      await payQR(
        scannedPayload.qr_code_id,
        scannedPayload.amountType === "dynamic" ? dynamicAmount : null,
        uuidv4()
      )
      
      alert("Payment successful!")
      mutate(["wallet", undefined])
      mutate(["transactions", undefined])
      handleClose()
    } catch (err: any) {
      alert("Payment failed: " + (err.message || err))
    } finally {
      setIsConfirming(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    // Reset state after close animation
    setTimeout(() => {
      setScannedPayload(null)
      setDynamicAmount("")
      setIsConfirming(false)
    }, 150)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose()
        } else {
          setOpen(true)
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <ScanLine className="size-5 text-primary" />
            </div>
            {scannedPayload ? "Confirm Payment" : "Scan QR Code"}
          </DialogTitle>
          <DialogDescription>
            {scannedPayload
              ? "Review the payment details before confirming."
              : "Point your camera at a QR code to pay."}
          </DialogDescription>
        </DialogHeader>

        {scannedPayload ? (
          <PaymentConfirmationView
            payload={scannedPayload}
            amount={dynamicAmount}
            setAmount={setDynamicAmount}
            onConfirm={handleConfirm}
            isConfirming={isConfirming}
          />
        ) : (
          <ScannerViewfinder onScan={handleScan} />
        )}
      </DialogContent>
    </Dialog>
  )
}
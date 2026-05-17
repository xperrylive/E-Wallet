"use client"

import { useState, useEffect, createContext, useContext, useCallback } from "react"
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react"

// ── Types ────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
}

interface ToastContextValue {
  toast: (opts: { type: ToastType; title: string; description?: string }) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

// ── Context ──────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>")
  return ctx
}

// ── Single Toast Item ────────────────────────────────────────

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const STYLES = {
  success: {
    bar: "bg-emerald-500",
    icon: "text-emerald-500",
    title: "text-foreground",
  },
  error: {
    bar: "bg-destructive",
    icon: "text-destructive",
    title: "text-foreground",
  },
  warning: {
    bar: "bg-yellow-500",
    icon: "text-yellow-500",
    title: "text-foreground",
  },
  info: {
    bar: "bg-primary",
    icon: "text-primary",
    title: "text-foreground",
  },
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = ICONS[toast.type]
  const style = STYLES[toast.type]

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4500)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      className="pointer-events-auto relative flex w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-lg"
      style={{ animation: "toast-in 0.25s cubic-bezier(0.16,1,0.3,1)" }}
      role="alert"
    >
      {/* Coloured left bar */}
      <div className={`w-1 shrink-0 ${style.bar}`} />

      <div className="flex flex-1 items-start gap-3 p-4">
        <Icon className={`mt-0.5 size-5 shrink-0 ${style.icon}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${style.title}`}>{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{toast.description}</p>
          )}
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="ml-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Provider + Toaster ────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(({ type, title, description }: { type: ToastType; title: string; description?: string }) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev.slice(-4), { id, type, title, description }])
  }, [])

  const success = useCallback((title: string, description?: string) => toast({ type: "success", title, description }), [toast])
  const error = useCallback((title: string, description?: string) => toast({ type: "error", title, description }), [toast])
  const warning = useCallback((title: string, description?: string) => toast({ type: "warning", title, description }), [toast])
  const info = useCallback((title: string, description?: string) => toast({ type: "info", title, description }), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toaster */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 sm:bottom-6 sm:right-6">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export interface Wallet {
  id: string
  user_id: string
  balance: string
  balance_cents: number
  currency: string
  status: "active" | "inactive" | "suspended"
  created_at: string
  updated_at: string
}

export interface WalletError {
  error: string
  code: string
}

export async function fetchWallet(token: string): Promise<Wallet> {
  const response = await fetch("/api/wallets/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const errorData: WalletError = await response.json()
    throw new Error(errorData.code || "UNKNOWN_ERROR")
  }

  return response.json()
}

export interface Transaction {
  id: string
  type: "sent" | "received"
  counterparty_wallet_id: string
  amount: string
  amount_cents: number
  currency: string
  status: "pending" | "completed" | "failed"
  description: string
  created_at: string
  balance_after: string
}

export interface TransactionsResponse {
  total: number
  page: number
  per_page: number
  total_pages: number
  transactions: Transaction[]
}

export async function fetchTransactions(token: string): Promise<TransactionsResponse> {
  const response = await fetch("/api/transactions", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const errorData: WalletError = await response.json()
    throw new Error(errorData.code || "UNKNOWN_ERROR")
  }

  return response.json()
}

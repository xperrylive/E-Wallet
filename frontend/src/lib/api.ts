import axios from 'axios';
import { supabase } from '../services/supabase';

export interface Wallet {
  id: string
  user_id: string
  balance: string
  balance_cents: number
  currency: string
  status: "active" | "frozen" | "suspended"
  created_at: string
  updated_at: string
}

export interface WalletError {
  error: string
  code: string
  details?: any
}

export interface Transaction {
  id: string
  type: "sent" | "received"
  counterparty_wallet_id: string
  amount: string
  amount_cents: number
  currency: string
  status: "pending" | "completed" | "failed" | "reversed"
  transaction_type: "transfer" | "qr_payment" | "topup" | "withdrawal"
  description: string
  created_at: string
  completed_at: string | null
  balance_after?: string
}

export interface TransactionsResponse {
  total: number
  page: number
  per_page: number
  total_pages: number
  transactions: Transaction[]
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login or handle unauthorized
    }
    return Promise.reject(error);
  }
);

export async function fetchWallet(token?: string): Promise<Wallet> {
  try {
    const response = await api.get('/wallets/me');
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.code || error.response.data.error || "UNKNOWN_ERROR");
    }
    throw error;
  }
}

export async function createWallet(currency: string = 'MYR'): Promise<Wallet> {
  const response = await api.post('/wallets/create', { currency });
  return response.data;
}

export async function fetchTransactions(token?: string, page: number = 1): Promise<TransactionsResponse> {
  try {
    const response = await api.get('/transactions', { params: { page } });
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.code || error.response.data.error || "UNKNOWN_ERROR");
    }
    throw error;
  }
}

export async function transferMoney(recipientWalletId: string, amount: string, description: string, idempotencyKey: string) {
  const response = await api.post('/transactions/transfer/', {
    recipient_wallet_id: recipientWalletId,
    amount,
    description,
    idempotency_key: idempotencyKey,
  });
  return response.data;
}

export async function generateQR(amount: string | null, qrType: 'static' | 'dynamic', description: string, expires_in_minutes: number = 15) {
  const payload: any = {
    qr_type: qrType,
    description,
    expires_in_minutes,
  };
  if (amount) {
    payload.amount = amount;
  }
  const response = await api.post('/qr-codes/generate/', payload);
  return response.data;
}

export async function payQR(qrCodeId: string, amount: string | null, idempotencyKey: string) {
  const payload: any = {
    qr_code_id: qrCodeId,
    idempotency_key: idempotencyKey,
  };
  if (amount) {
    payload.amount = amount;
  }
  const response = await api.post('/qr-codes/pay/', payload);
  return response.data;
}

export default api;

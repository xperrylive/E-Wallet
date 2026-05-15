// API service layer with Axios interceptors for JWT auth
// TODO: Implement full API service

import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const walletAPI = {
  getMyWallet: () => api.get('/wallets/me'),
  createWallet: (currency = 'MYR') => api.post('/wallets/create', { currency }),
};

export const transactionAPI = {
  transfer: (data) => api.post('/transactions/transfer', data),
  getTransactions: (params) => api.get('/transactions', { params }),
  getTransaction: (id) => api.get(`/transactions/${id}`),
};

export const qrCodeAPI = {
  generate: (data) => api.post('/qr-codes/generate', data),
  pay: (data) => api.post('/qr-codes/pay', data),
  getMyQRCodes: (params) => api.get('/qr-codes/me', { params }),
};

export const webhookAPI = {
  create: (data) => api.post('/webhooks', data),
  list: () => api.get('/webhooks'),
  delete: (id) => api.delete(`/webhooks/${id}`),
};

export default api;

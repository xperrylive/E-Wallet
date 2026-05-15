# Mini Digital Wallet API

Production-ready digital wallet system with peer-to-peer transfers, QR payments, and webhooks.

## Features
- Wallet-to-wallet money transfers
- QR code payments (static & dynamic)
- Transaction history with filtering
- Webhook notifications for integrations
- Real-time balance updates via Supabase
- Financial-grade integrity (atomic transactions, idempotency)

## Tech Stack
**Backend:** Django 5.0, DRF, Celery, Redis, PostgreSQL  
**Frontend:** React 18, Tailwind CSS, React Query  
**Infrastructure:** Supabase (Auth + DB), Railway (Backend), Vercel (Frontend)

## Architecture

```
Frontend (React/Vite)  →  API (Django REST Framework)  →  PostgreSQL (Supabase)
                                    ↓
                              Celery + Redis
                                    ↓
                            Webhook Delivery
```

## Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase account
- Railway account (backend)
- Vercel account (frontend)

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Fill in your credentials
python manage.py migrate
python manage.py runserver
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local  # Fill in your credentials
npm run dev
```

## API Documentation
Full API docs available at: `/api/docs`

## Key Technical Decisions

### Why store money as integers (cents)?
Floating-point arithmetic is imprecise. Storing as cents (integers) ensures exact calculations.

### Atomic Transactions
All balance updates use Django's `transaction.atomic()` with `select_for_update()` to prevent race conditions.

### Idempotency Keys
Every transfer requires a unique idempotency key. Duplicate requests return the original result, preventing double-charges.

### Webhooks
Async webhook delivery via Celery with automatic retries (exponential backoff).

## What I'd Improve with More Time
- Multi-currency exchange rates (integrate external API)
- Fraud detection ML model (flag suspicious patterns)
- Recurring payments (subscriptions)
- Transaction disputes/reversals
- Two-factor authentication (TOTP)

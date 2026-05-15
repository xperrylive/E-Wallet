# Mini Digital Wallet - Technical Product Requirements Document

## 1. Executive Summary

A production-ready digital wallet API system enabling peer-to-peer money transfers, QR code payments, and transaction tracking with financial-grade integrity. Built with Django REST Framework backend and React frontend, featuring atomic transactions, idempotency guarantees, and webhook notifications.

**Target completion:** 5 days  
**Core metric:** Enable secure money transfers with zero transaction integrity issues

---

## 2. The Core Loop (Critical User Journey)

**Primary Flow: Wallet-to-Wallet Transfer**

```
1. User authenticates via Supabase Auth (JWT token)
2. User views their wallet balance on dashboard
3. User initiates transfer:
   - Enters recipient wallet ID
   - Enters amount (in MYR)
   - Adds optional description
4. System validates:
   - Sufficient balance
   - Valid recipient
   - Amount within limits
5. System executes atomic transfer:
   - Debit sender wallet
   - Credit recipient wallet
   - Create transaction record
   - All-or-nothing (database transaction)
6. System returns transaction receipt
7. Frontend updates balance in real-time (Supabase realtime subscription)
8. Background job sends webhook notification (if configured)
```

**Success Criteria:**
- Transfer completes in <500ms
- Balance updates reflect immediately
- No duplicate transfers (idempotency)
- Audit trail exists for every state change

---

## 3. Tech Stack

### Frontend
- **Framework:** React 18.x with Vite
- **Styling:** Tailwind CSS 3.x
- **State Management:** React Query (TanStack Query) for server state
- **Auth:** Supabase JS Client (`@supabase/supabase-js`)
- **HTTP Client:** Axios with interceptors for JWT
- **QR Code:** `react-qr-code` for generation, `html5-qrcode` for scanning
- **Routing:** React Router v6
- **Deployment:** Vercel

### Backend
- **Framework:** Django 5.0.x
- **API:** Django REST Framework 3.14.x
- **Task Queue:** Celery 5.3.x with Redis broker
- **Authentication:** Supabase Auth (JWT verification via `supabase-py`)
- **Database:** PostgreSQL 15+ via Supabase
- **CORS:** `django-cors-headers`
- **Environment:** Python 3.11+
- **Deployment:** Railway

### Infrastructure
- **Database/Auth:** Supabase (PostgreSQL + Auth + Realtime)
- **Cache/Queue:** Redis (Railway addon or Upstash)
- **File Storage:** Supabase Storage (for QR code images)

### Key Python Packages
```txt
Django==5.0.6
djangorestframework==3.14.0
django-cors-headers==4.3.1
celery==5.3.4
redis==5.0.1
supabase==2.4.0
PyJWT==2.8.0
qrcode[pil]==7.4.2
Pillow==10.2.0
python-dotenv==1.0.0
gunicorn==21.2.0
psycopg2-binary==2.9.9
```

---

## 4. Database Schema

### 4.1 Tables Overview

**Note:** `auth.users` table is managed by Supabase Auth. We reference it via foreign keys but don't manage it directly.

### 4.2 Wallets Table

```sql
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'MYR',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, currency)
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_status ON wallets(status);
```

**Django Model:**
```python
class Wallet(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('frozen', 'Frozen'),
        ('suspended', 'Suspended'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(db_index=True)  # References Supabase auth.users
    balance_cents = models.BigIntegerField(default=0, validators=[MinValueValidator(0)])
    currency = models.CharField(max_length=3, default='MYR')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'wallets'
        unique_together = [('user_id', 'currency')]
```

### 4.3 Transactions Table

```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    recipient_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'MYR',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'transfer' CHECK (transaction_type IN ('transfer', 'qr_payment', 'topup', 'withdrawal')),
    description TEXT,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    CHECK (sender_wallet_id != recipient_wallet_id)
);

CREATE INDEX idx_transactions_sender ON transactions(sender_wallet_id, created_at DESC);
CREATE INDEX idx_transactions_recipient ON transactions(recipient_wallet_id, created_at DESC);
CREATE INDEX idx_transactions_idempotency ON transactions(idempotency_key);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
```

**Django Model:**
```python
class Transaction(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('reversed', 'Reversed'),
    ]
    
    TYPE_CHOICES = [
        ('transfer', 'Transfer'),
        ('qr_payment', 'QR Payment'),
        ('topup', 'Top Up'),
        ('withdrawal', 'Withdrawal'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender_wallet = models.ForeignKey(Wallet, on_delete=models.RESTRICT, related_name='sent_transactions')
    recipient_wallet = models.ForeignKey(Wallet, on_delete=models.RESTRICT, related_name='received_transactions')
    amount_cents = models.BigIntegerField(validators=[MinValueValidator(1)])
    currency = models.CharField(max_length=3, default='MYR')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='transfer')
    description = models.TextField(blank=True, null=True)
    idempotency_key = models.CharField(max_length=255, unique=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'transactions'
        ordering = ['-created_at']
```

### 4.4 QR Codes Table

```sql
CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_code_id VARCHAR(100) NOT NULL UNIQUE,
    merchant_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    amount_cents BIGINT CHECK (amount_cents > 0 OR amount_cents IS NULL),
    qr_type VARCHAR(20) NOT NULL DEFAULT 'static' CHECK (qr_type IN ('static', 'dynamic')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'cancelled')),
    description TEXT,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qr_codes_qr_code_id ON qr_codes(qr_code_id);
CREATE INDEX idx_qr_codes_merchant ON qr_codes(merchant_wallet_id);
CREATE INDEX idx_qr_codes_expires_at ON qr_codes(expires_at);
CREATE INDEX idx_qr_codes_status ON qr_codes(status);
```

**Django Model:**
```python
class QRCode(models.Model):
    TYPE_CHOICES = [
        ('static', 'Static Amount'),
        ('dynamic', 'Dynamic Amount'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('used', 'Used'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    qr_code_id = models.CharField(max_length=100, unique=True, db_index=True)
    merchant_wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='qr_codes')
    amount_cents = models.BigIntegerField(null=True, blank=True, validators=[MinValueValidator(1)])
    qr_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='static')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    description = models.TextField(blank=True, null=True)
    max_uses = models.IntegerField(default=1)
    current_uses = models.IntegerField(default=0)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'qr_codes'
```

### 4.5 Webhooks Table

```sql
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret VARCHAR(255) NOT NULL,
    events JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_wallet ON webhooks(wallet_id);
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active);
```

**Django Model:**
```python
class Webhook(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(Wallet, on_delete=models.CASCADE, related_name='webhooks')
    url = models.URLField(max_length=2048)
    secret = models.CharField(max_length=255)
    events = models.JSONField(default=list)  # e.g., ['transaction.completed', 'qr_code.paid']
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'webhooks'
```

### 4.6 Webhook Deliveries Table

```sql
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    status_code INTEGER,
    response_body TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_transaction ON webhook_deliveries(transaction_id);
CREATE INDEX idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at DESC);
```

**Django Model:**
```python
class WebhookDelivery(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    webhook = models.ForeignKey(Webhook, on_delete=models.CASCADE, related_name='deliveries')
    transaction = models.ForeignKey(Transaction, on_delete=models.SET_NULL, null=True, blank=True)
    event_type = models.CharField(max_length=50)
    payload = models.JSONField()
    status_code = models.IntegerField(null=True, blank=True)
    response_body = models.TextField(blank=True, null=True)
    retry_count = models.IntegerField(default=0)
    delivered_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'webhook_deliveries'
        ordering = ['-delivered_at']
```

---

## 5. API Contracts

### 5.1 Authentication

**All API requests require JWT token from Supabase Auth in header:**
```
Authorization: Bearer <supabase_jwt_token>
```

**Backend JWT Verification:**
```python
import jwt
from supabase import create_client
from rest_framework.authentication import BaseAuthentication

class SupabaseAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None
        
        token = auth_header.split(' ')[1]
        
        try:
            # Verify JWT using Supabase public key
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            user = supabase.auth.get_user(token)
            
            if user:
                request.user_id = user.user.id  # Store user_id for later use
                return (user, token)
        except Exception as e:
            raise AuthenticationFailed('Invalid token')
        
        return None
```

### 5.2 Wallets API

#### GET /api/wallets/me
**Description:** Get current user's wallet  
**Headers:** `Authorization: Bearer <token>`  
**Response 200:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "auth-user-uuid",
  "balance": "100.50",
  "balance_cents": 10050,
  "currency": "MYR",
  "status": "active",
  "created_at": "2026-05-15T10:00:00Z",
  "updated_at": "2026-05-15T12:30:00Z"
}
```

**Response 404:**
```json
{
  "error": "Wallet not found",
  "code": "WALLET_NOT_FOUND"
}
```

#### POST /api/wallets/create
**Description:** Create wallet for authenticated user (auto-called on first login)  
**Headers:** `Authorization: Bearer <token>`  
**Request Body:**
```json
{
  "currency": "MYR"
}
```

**Response 201:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "auth-user-uuid",
  "balance": "0.00",
  "balance_cents": 0,
  "currency": "MYR",
  "status": "active",
  "created_at": "2026-05-15T10:00:00Z"
}
```

**Response 400:**
```json
{
  "error": "Wallet already exists",
  "code": "WALLET_EXISTS"
}
```

### 5.3 Transactions API

#### POST /api/transactions/transfer
**Description:** Execute wallet-to-wallet transfer (atomic operation)  
**Headers:** `Authorization: Bearer <token>`  
**Request Body:**
```json
{
  "recipient_wallet_id": "650e8400-e29b-41d4-a716-446655440001",
  "amount": "25.50",
  "description": "Lunch payment",
  "idempotency_key": "client-generated-uuid-v4"
}
```

**Field Validations:**
- `recipient_wallet_id`: Required, UUID, must exist, cannot be sender's wallet
- `amount`: Required, string (decimal), min 0.01, max 5000.00
- `description`: Optional, string, max 500 chars
- `idempotency_key`: Required, UUID v4, unique per request

**Response 201:**
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440002",
  "sender_wallet_id": "550e8400-e29b-41d4-a716-446655440000",
  "recipient_wallet_id": "650e8400-e29b-41d4-a716-446655440001",
  "amount": "25.50",
  "amount_cents": 2550,
  "currency": "MYR",
  "status": "completed",
  "transaction_type": "transfer",
  "description": "Lunch payment",
  "created_at": "2026-05-15T12:30:00Z",
  "completed_at": "2026-05-15T12:30:01Z",
  "sender_balance_after": "74.50",
  "recipient_balance_after": "125.50"
}
```

**Response 400 (Insufficient Funds):**
```json
{
  "error": "Insufficient funds",
  "code": "INSUFFICIENT_FUNDS",
  "details": {
    "required": "25.50",
    "available": "20.00"
  }
}
```

**Response 400 (Invalid Recipient):**
```json
{
  "error": "Recipient wallet not found",
  "code": "INVALID_RECIPIENT"
}
```

**Response 409 (Duplicate Request):**
```json
{
  "error": "Transaction already processed",
  "code": "DUPLICATE_TRANSACTION",
  "transaction_id": "750e8400-e29b-41d4-a716-446655440002"
}
```

#### GET /api/transactions
**Description:** Get transaction history with filtering  
**Headers:** `Authorization: Bearer <token>`  
**Query Parameters:**
- `type`: Optional, enum ['sent', 'received', 'all'], default 'all'
- `status`: Optional, enum ['pending', 'completed', 'failed'], default 'all'
- `start_date`: Optional, ISO8601 date, e.g., '2026-05-01T00:00:00Z'
- `end_date`: Optional, ISO8601 date
- `page`: Optional, integer, default 1
- `per_page`: Optional, integer, default 20, max 100

**Response 200:**
```json
{
  "total": 247,
  "page": 1,
  "per_page": 20,
  "total_pages": 13,
  "transactions": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440002",
      "type": "sent",
      "counterparty_wallet_id": "650e8400-e29b-41d4-a716-446655440001",
      "amount": "-25.50",
      "amount_cents": -2550,
      "currency": "MYR",
      "status": "completed",
      "description": "Lunch payment",
      "created_at": "2026-05-15T12:30:00Z",
      "balance_after": "74.50"
    },
    {
      "id": "750e8400-e29b-41d4-a716-446655440003",
      "type": "received",
      "counterparty_wallet_id": "850e8400-e29b-41d4-a716-446655440005",
      "amount": "50.00",
      "amount_cents": 5000,
      "currency": "MYR",
      "status": "completed",
      "description": "Refund",
      "created_at": "2026-05-14T18:00:00Z",
      "balance_after": "100.00"
    }
  ]
}
```

#### GET /api/transactions/:id
**Description:** Get single transaction details  
**Headers:** `Authorization: Bearer <token>`  
**Response 200:**
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440002",
  "sender_wallet_id": "550e8400-e29b-41d4-a716-446655440000",
  "recipient_wallet_id": "650e8400-e29b-41d4-a716-446655440001",
  "amount": "25.50",
  "amount_cents": 2550,
  "currency": "MYR",
  "status": "completed",
  "transaction_type": "transfer",
  "description": "Lunch payment",
  "idempotency_key": "client-uuid",
  "metadata": {},
  "created_at": "2026-05-15T12:30:00Z",
  "completed_at": "2026-05-15T12:30:01Z"
}
```

**Response 404:**
```json
{
  "error": "Transaction not found",
  "code": "TRANSACTION_NOT_FOUND"
}
```

### 5.4 QR Codes API

#### POST /api/qr-codes/generate
**Description:** Generate QR code for payment  
**Headers:** `Authorization: Bearer <token>`  
**Request Body:**
```json
{
  "amount": "25.00",
  "qr_type": "static",
  "description": "Coffee payment",
  "expires_in_minutes": 15,
  "max_uses": 1
}
```

**Field Validations:**
- `amount`: Required for static, null for dynamic, string (decimal), min 0.01
- `qr_type`: Required, enum ['static', 'dynamic']
- `description`: Optional, string, max 200 chars
- `expires_in_minutes`: Optional, integer, default 15, max 1440 (24 hours)
- `max_uses`: Optional, integer, default 1, max 100

**Response 201:**
```json
{
  "id": "850e8400-e29b-41d4-a716-446655440010",
  "qr_code_id": "QR-20260515-ABC123",
  "merchant_wallet_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": "25.00",
  "amount_cents": 2500,
  "qr_type": "static",
  "status": "active",
  "description": "Coffee payment",
  "max_uses": 1,
  "current_uses": 0,
  "qr_image_url": "https://your-supabase.storage/qr-codes/QR-20260515-ABC123.png",
  "qr_data": "ewallet://pay?qr_id=QR-20260515-ABC123&amount=2500&merchant=550e8400-e29b-41d4-a716-446655440000",
  "expires_at": "2026-05-15T12:45:00Z",
  "created_at": "2026-05-15T12:30:00Z"
}
```

#### POST /api/qr-codes/pay
**Description:** Pay using QR code  
**Headers:** `Authorization: Bearer <token>`  
**Request Body:**
```json
{
  "qr_code_id": "QR-20260515-ABC123",
  "amount": "25.00",
  "idempotency_key": "client-generated-uuid-v4"
}
```

**Field Validations:**
- `qr_code_id`: Required, string, must exist and be active
- `amount`: Required for dynamic QR, ignored for static QR, string (decimal)
- `idempotency_key`: Required, UUID v4

**Response 201:**
```json
{
  "transaction": {
    "id": "950e8400-e29b-41d4-a716-446655440020",
    "sender_wallet_id": "650e8400-e29b-41d4-a716-446655440001",
    "recipient_wallet_id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": "25.00",
    "amount_cents": 2500,
    "currency": "MYR",
    "status": "completed",
    "transaction_type": "qr_payment",
    "description": "QR Payment: Coffee payment",
    "created_at": "2026-05-15T12:35:00Z",
    "completed_at": "2026-05-15T12:35:01Z"
  },
  "qr_code": {
    "id": "850e8400-e29b-41d4-a716-446655440010",
    "qr_code_id": "QR-20260515-ABC123",
    "status": "used",
    "current_uses": 1
  }
}
```

**Response 400 (QR Expired):**
```json
{
  "error": "QR code has expired",
  "code": "QR_EXPIRED",
  "expired_at": "2026-05-15T12:45:00Z"
}
```

**Response 400 (QR Already Used):**
```json
{
  "error": "QR code has already been used",
  "code": "QR_ALREADY_USED",
  "max_uses": 1,
  "current_uses": 1
}
```

#### GET /api/qr-codes/me
**Description:** Get user's generated QR codes  
**Headers:** `Authorization: Bearer <token>`  
**Query Parameters:**
- `status`: Optional, enum ['active', 'used', 'expired'], default 'all'
- `page`: Optional, integer, default 1

**Response 200:**
```json
{
  "total": 15,
  "page": 1,
  "per_page": 20,
  "qr_codes": [
    {
      "id": "850e8400-e29b-41d4-a716-446655440010",
      "qr_code_id": "QR-20260515-ABC123",
      "amount": "25.00",
      "qr_type": "static",
      "status": "used",
      "description": "Coffee payment",
      "max_uses": 1,
      "current_uses": 1,
      "qr_image_url": "https://your-supabase.storage/qr-codes/QR-20260515-ABC123.png",
      "expires_at": "2026-05-15T12:45:00Z",
      "created_at": "2026-05-15T12:30:00Z"
    }
  ]
}
```

### 5.5 Webhooks API

#### POST /api/webhooks
**Description:** Register webhook endpoint  
**Headers:** `Authorization: Bearer <token>`  
**Request Body:**
```json
{
  "url": "https://merchant.com/webhook",
  "events": ["transaction.completed", "qr_code.paid"]
}
```

**Field Validations:**
- `url`: Required, valid HTTPS URL
- `events`: Required, array of strings, valid events: ['transaction.completed', 'transaction.failed', 'qr_code.paid', 'qr_code.expired']

**Response 201:**
```json
{
  "id": "a50e8400-e29b-41d4-a716-446655440030",
  "wallet_id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://merchant.com/webhook",
  "secret": "whsec_abc123def456ghi789",
  "events": ["transaction.completed", "qr_code.paid"],
  "is_active": true,
  "created_at": "2026-05-15T12:00:00Z"
}
```

#### GET /api/webhooks
**Description:** List user's webhooks  
**Headers:** `Authorization: Bearer <token>`  
**Response 200:**
```json
{
  "webhooks": [
    {
      "id": "a50e8400-e29b-41d4-a716-446655440030",
      "url": "https://merchant.com/webhook",
      "events": ["transaction.completed", "qr_code.paid"],
      "is_active": true,
      "created_at": "2026-05-15T12:00:00Z",
      "total_deliveries": 42,
      "last_delivery_at": "2026-05-15T14:30:00Z"
    }
  ]
}
```

#### DELETE /api/webhooks/:id
**Description:** Delete webhook  
**Headers:** `Authorization: Bearer <token>`  
**Response 204:** No content

---

## 6. Business Logic Implementation

### 6.1 Atomic Transfer Logic

**File:** `backend/wallet/services.py`

```python
from django.db import transaction as db_transaction
from django.utils import timezone
from decimal import Decimal
from .models import Wallet, Transaction
from .exceptions import InsufficientFundsError, InvalidRecipientError, DuplicateTransactionError

class TransferService:
    @staticmethod
    def execute_transfer(sender_wallet_id, recipient_wallet_id, amount_str, description, idempotency_key):
        """
        Execute atomic wallet-to-wallet transfer.
        
        Args:
            sender_wallet_id (UUID): Sender's wallet ID
            recipient_wallet_id (UUID): Recipient's wallet ID
            amount_str (str): Amount in decimal format (e.g., "25.50")
            description (str): Transfer description
            idempotency_key (str): Unique request identifier
            
        Returns:
            Transaction: Completed transaction object
            
        Raises:
            InsufficientFundsError: If sender has insufficient balance
            InvalidRecipientError: If recipient wallet doesn't exist
            DuplicateTransactionError: If idempotency_key already used
        """
        
        # Check for duplicate request
        existing_txn = Transaction.objects.filter(idempotency_key=idempotency_key).first()
        if existing_txn:
            raise DuplicateTransactionError(
                message="Transaction already processed",
                transaction_id=str(existing_txn.id)
            )
        
        # Convert amount to cents
        amount_decimal = Decimal(amount_str)
        amount_cents = int(amount_decimal * 100)
        
        # Validate amount
        if amount_cents <= 0:
            raise ValueError("Amount must be greater than 0")
        
        if amount_cents > 500000:  # Max 5000.00 MYR
            raise ValueError("Amount exceeds maximum limit of 5000.00")
        
        # Start atomic database transaction
        with db_transaction.atomic():
            # Lock wallets for update (prevents race conditions)
            sender_wallet = Wallet.objects.select_for_update().get(id=sender_wallet_id)
            recipient_wallet = Wallet.objects.select_for_update().get(id=recipient_wallet_id)
            
            # Validate wallets
            if sender_wallet.status != 'active':
                raise ValueError("Sender wallet is not active")
            
            if recipient_wallet.status not in ['active', 'frozen']:
                raise InvalidRecipientError("Recipient wallet cannot receive funds")
            
            if sender_wallet.id == recipient_wallet.id:
                raise ValueError("Cannot transfer to same wallet")
            
            # Check sufficient balance
            if sender_wallet.balance_cents < amount_cents:
                raise InsufficientFundsError(
                    required=amount_str,
                    available=str(sender_wallet.balance_cents / 100)
                )
            
            # Create transaction record (pending state)
            txn = Transaction.objects.create(
                sender_wallet=sender_wallet,
                recipient_wallet=recipient_wallet,
                amount_cents=amount_cents,
                currency='MYR',
                status='pending',
                transaction_type='transfer',
                description=description,
                idempotency_key=idempotency_key
            )
            
            # Execute balance updates
            sender_wallet.balance_cents -= amount_cents
            recipient_wallet.balance_cents += amount_cents
            
            sender_wallet.save(update_fields=['balance_cents', 'updated_at'])
            recipient_wallet.save(update_fields=['balance_cents', 'updated_at'])
            
            # Mark transaction as completed
            txn.status = 'completed'
            txn.completed_at = timezone.now()
            txn.save(update_fields=['status', 'completed_at'])
        
        # After commit, trigger async webhook notification
        from .tasks import send_webhook_notification
        send_webhook_notification.delay(str(txn.id), 'transaction.completed')
        
        return txn
```

### 6.2 QR Payment Logic

**File:** `backend/wallet/services.py`

```python
import secrets
import string
from django.utils import timezone
from datetime import timedelta
import qrcode
from io import BytesIO

class QRCodeService:
    @staticmethod
    def generate_qr_code(merchant_wallet_id, amount_str, qr_type, description, expires_in_minutes, max_uses):
        """
        Generate QR code for payment.
        
        Returns:
            (QRCode object, image BytesIO)
        """
        from .models import QRCode, Wallet
        
        # Validate merchant wallet
        merchant_wallet = Wallet.objects.get(id=merchant_wallet_id)
        if merchant_wallet.status != 'active':
            raise ValueError("Merchant wallet is not active")
        
        # Generate unique QR code ID
        qr_code_id = QRCodeService._generate_qr_id()
        
        # Calculate expiration
        expires_at = timezone.now() + timedelta(minutes=expires_in_minutes)
        
        # Convert amount to cents
        amount_cents = None
        if qr_type == 'static' and amount_str:
            amount_cents = int(Decimal(amount_str) * 100)
        
        # Create QR code record
        qr_code = QRCode.objects.create(
            qr_code_id=qr_code_id,
            merchant_wallet=merchant_wallet,
            amount_cents=amount_cents,
            qr_type=qr_type,
            status='active',
            description=description,
            max_uses=max_uses,
            current_uses=0,
            expires_at=expires_at
        )
        
        # Generate QR code image
        qr_data = f"ewallet://pay?qr_id={qr_code_id}&amount={amount_cents or 0}&merchant={merchant_wallet_id}"
        
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(qr_data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        img_buffer = BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        return qr_code, img_buffer, qr_data
    
    @staticmethod
    def _generate_qr_id():
        """Generate unique QR code ID: QR-YYYYMMDD-RANDOM6"""
        date_str = timezone.now().strftime('%Y%m%d')
        random_str = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
        return f"QR-{date_str}-{random_str}"
    
    @staticmethod
    def process_qr_payment(qr_code_id, payer_wallet_id, amount_str, idempotency_key):
        """
        Process payment via QR code.
        
        Returns:
            (Transaction, QRCode): Completed transaction and updated QR code
        """
        from .models import QRCode, Transaction
        from django.db import transaction as db_transaction
        
        with db_transaction.atomic():
            # Lock QR code for update
            qr_code = QRCode.objects.select_for_update().get(qr_code_id=qr_code_id)
            
            # Validate QR code status
            if qr_code.status != 'active':
                raise ValueError(f"QR code is {qr_code.status}")
            
            # Check expiration
            if timezone.now() > qr_code.expires_at:
                qr_code.status = 'expired'
                qr_code.save(update_fields=['status'])
                raise ValueError("QR code has expired")
            
            # Check usage limit
            if qr_code.current_uses >= qr_code.max_uses:
                qr_code.status = 'used'
                qr_code.save(update_fields=['status'])
                raise ValueError("QR code has already been used")
            
            # Determine amount
            if qr_code.qr_type == 'static':
                payment_amount_cents = qr_code.amount_cents
                payment_amount_str = str(payment_amount_cents / 100)
            else:  # dynamic
                payment_amount_str = amount_str
                payment_amount_cents = int(Decimal(amount_str) * 100)
            
            # Execute transfer
            txn = TransferService.execute_transfer(
                sender_wallet_id=payer_wallet_id,
                recipient_wallet_id=qr_code.merchant_wallet_id,
                amount_str=payment_amount_str,
                description=f"QR Payment: {qr_code.description or 'No description'}",
                idempotency_key=idempotency_key
            )
            
            # Update QR code
            txn.transaction_type = 'qr_payment'
            txn.metadata = {'qr_code_id': qr_code_id}
            txn.save(update_fields=['transaction_type', 'metadata'])
            
            # Increment usage
            qr_code.current_uses += 1
            if qr_code.current_uses >= qr_code.max_uses:
                qr_code.status = 'used'
            qr_code.save(update_fields=['current_uses', 'status'])
        
        # Trigger webhook
        from .tasks import send_webhook_notification
        send_webhook_notification.delay(str(txn.id), 'qr_code.paid')
        
        return txn, qr_code
```

### 6.3 Webhook Notification Logic

**File:** `backend/wallet/tasks.py`

```python
from celery import shared_task
import requests
import hmac
import hashlib
import json
from django.utils import timezone
from .models import Webhook, WebhookDelivery, Transaction

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_webhook_notification(self, transaction_id, event_type):
    """
    Send webhook notification for transaction event.
    
    Args:
        transaction_id (str): Transaction UUID
        event_type (str): Event type (e.g., 'transaction.completed')
    """
    try:
        txn = Transaction.objects.get(id=transaction_id)
        
        # Find active webhooks for recipient wallet
        webhooks = Webhook.objects.filter(
            wallet_id=txn.recipient_wallet_id,
            is_active=True,
            events__contains=[event_type]
        )
        
        for webhook in webhooks:
            # Prepare payload
            payload = {
                "event": event_type,
                "timestamp": timezone.now().isoformat(),
                "data": {
                    "transaction_id": str(txn.id),
                    "amount": str(txn.amount_cents / 100),
                    "amount_cents": txn.amount_cents,
                    "currency": txn.currency,
                    "sender_wallet_id": str(txn.sender_wallet_id),
                    "recipient_wallet_id": str(txn.recipient_wallet_id),
                    "description": txn.description,
                    "status": txn.status,
                    "created_at": txn.created_at.isoformat(),
                    "completed_at": txn.completed_at.isoformat() if txn.completed_at else None
                }
            }
            
            # Generate HMAC signature
            payload_str = json.dumps(payload, sort_keys=True)
            signature = hmac.new(
                webhook.secret.encode(),
                payload_str.encode(),
                hashlib.sha256
            ).hexdigest()
            
            # Send webhook
            try:
                response = requests.post(
                    webhook.url,
                    json=payload,
                    headers={
                        'Content-Type': 'application/json',
                        'X-Webhook-Signature': f'sha256={signature}',
                        'X-Webhook-Event': event_type
                    },
                    timeout=10
                )
                
                # Log delivery
                WebhookDelivery.objects.create(
                    webhook_id=webhook.id,
                    transaction_id=txn.id,
                    event_type=event_type,
                    payload=payload,
                    status_code=response.status_code,
                    response_body=response.text[:1000],
                    retry_count=self.request.retries
                )
                
                # If failed, retry
                if response.status_code >= 400:
                    raise Exception(f"Webhook delivery failed with status {response.status_code}")
                    
            except requests.RequestException as exc:
                # Log failed delivery
                WebhookDelivery.objects.create(
                    webhook_id=webhook.id,
                    transaction_id=txn.id,
                    event_type=event_type,
                    payload=payload,
                    status_code=None,
                    response_body=str(exc)[:1000],
                    retry_count=self.request.retries
                )
                
                # Retry with exponential backoff
                raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
    
    except Transaction.DoesNotExist:
        # Transaction not found, don't retry
        pass
    except Exception as exc:
        # Log error and retry
        raise self.retry(exc=exc)
```

### 6.4 QR Code Expiration Task

**File:** `backend/wallet/tasks.py`

```python
@shared_task
def expire_qr_codes():
    """
    Scheduled task to mark expired QR codes.
    Run every 1 minute via Celery Beat.
    """
    from django.utils import timezone
    from .models import QRCode
    
    expired_count = QRCode.objects.filter(
        status='active',
        expires_at__lt=timezone.now()
    ).update(status='expired')
    
    return f"Expired {expired_count} QR codes"
```

**Celery Beat Schedule** in `backend/config/celery.py`:
```python
from celery.schedules import crontab

app.conf.beat_schedule = {
    'expire-qr-codes': {
        'task': 'wallet.tasks.expire_qr_codes',
        'schedule': 60.0,  # Every 60 seconds
    },
}
```

---

## 7. Frontend Implementation Guide

### 7.1 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx
│   │   ├── TransferForm.jsx
│   │   ├── TransactionHistory.jsx
│   │   ├── QRGenerator.jsx
│   │   ├── QRScanner.jsx
│   │   └── WalletBalance.jsx
│   ├── hooks/
│   │   ├── useWallet.js
│   │   ├── useTransactions.js
│   │   └── useSupabaseAuth.js
│   ├── services/
│   │   ├── api.js
│   │   └── supabase.js
│   ├── utils/
│   │   └── formatters.js
│   ├── App.jsx
│   └── main.jsx
├── .env.local
└── package.json
```

### 7.2 Environment Variables

**Frontend `.env.local`:**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=https://your-backend.railway.app/api
```

**Backend `.env`:**
```bash
DJANGO_SECRET_KEY=your-django-secret-key
DJANGO_DEBUG=False
ALLOWED_HOSTS=your-backend.railway.app,localhost

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres

# Redis (Railway addon or Upstash)
REDIS_URL=redis://default:[password]@redis-xxx.railway.app:6379

# CORS
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173
```

### 7.3 API Service Layer

**File:** `frontend/src/services/api.js`

```javascript
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
      // Redirect to login
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
```

### 7.4 Supabase Real-time Integration

**File:** `frontend/src/hooks/useWallet.js`

```javascript
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletAPI } from '../services/api';
import { supabase } from '../services/supabase';

export function useWallet() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);

  // Fetch wallet data
  const { data: wallet, isLoading, error } = useQuery({
    queryKey: ['wallet', userId],
    queryFn: async () => {
      const response = await walletAPI.getMyWallet();
      return response.data;
    },
    enabled: !!userId,
  });

  // Subscribe to real-time balance updates
  useEffect(() => {
    if (!wallet?.id) return;

    const channel = supabase
      .channel(`wallet:${wallet.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `id=eq.${wallet.id}`,
        },
        (payload) => {
          // Update React Query cache
          queryClient.setQueryData(['wallet', userId], payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [wallet?.id, queryClient, userId]);

  return {
    wallet,
    isLoading,
    error,
  };
}
```

### 7.5 Transfer Form Component

**File:** `frontend/src/components/TransferForm.jsx`

```jsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionAPI } from '../services/api';
import { v4 as uuidv4 } from 'uuid';

export function TransferForm({ wallet }) {
  const queryClient = useQueryClient();
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const transferMutation = useMutation({
    mutationFn: (data) => transactionAPI.transfer(data),
    onSuccess: () => {
      // Invalidate wallet and transactions cache
      queryClient.invalidateQueries(['wallet']);
      queryClient.invalidateQueries(['transactions']);
      
      // Reset form
      setRecipientId('');
      setAmount('');
      setDescription('');
      
      alert('Transfer successful!');
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.error || 'Transfer failed';
      alert(errorMessage);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!recipientId || !amount) {
      alert('Please fill in all required fields');
      return;
    }

    transferMutation.mutate({
      recipient_wallet_id: recipientId,
      amount: amount,
      description: description,
      idempotency_key: uuidv4(),
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Send Money</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient Wallet ID
          </label>
          <input
            type="text"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            placeholder="e.g., 550e8400-e29b-41d4-a716-446655440001"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount (MYR)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="5000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Available balance: RM {(wallet?.balance_cents / 100).toFixed(2)}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description (Optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Lunch payment"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={transferMutation.isPending}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {transferMutation.isPending ? 'Processing...' : 'Send Money'}
        </button>
      </form>
    </div>
  );
}
```

---

## 8. Deployment Plan

### 8.1 Backend Deployment (Railway)

**Prerequisites:**
- Railway account
- GitHub repository with backend code

**Steps:**

1. **Create Railway Project**
   ```bash
   # Install Railway CLI
   npm i -g @railway/cli
   
   # Login
   railway login
   
   # Initialize project
   railway init
   ```

2. **Add PostgreSQL (Supabase Connection)**
   - Use Supabase PostgreSQL connection string
   - Add to environment variables

3. **Add Redis**
   ```bash
   railway add redis
   ```

4. **Environment Variables** (Railway Dashboard)
   ```bash
   DJANGO_SECRET_KEY=<generate-with-python>
   DJANGO_DEBUG=False
   ALLOWED_HOSTS=*.railway.app
   DATABASE_URL=<supabase-postgres-url>
   SUPABASE_URL=<your-supabase-url>
   SUPABASE_KEY=<service-role-key>
   SUPABASE_JWT_SECRET=<jwt-secret>
   REDIS_URL=${{Redis.REDIS_URL}}
   CORS_ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app
   ```

5. **Create `railway.toml`**
   ```toml
   [build]
   builder = "NIXPACKS"
   buildCommand = "pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate"

   [deploy]
   startCommand = "gunicorn config.wsgi:application --bind 0.0.0.0:$PORT"
   restartPolicyType = "ON_FAILURE"
   restartPolicyMaxRetries = 10
   ```

6. **Celery Worker (Separate Service)**
   ```bash
   # Create new service in same project
   railway add
   
   # In new service, use same environment variables
   # Start command:
   celery -A config worker --loglevel=info
   ```

7. **Celery Beat (Scheduled Tasks)**
   ```bash
   # Create another service
   # Start command:
   celery -A config beat --loglevel=info
   ```

8. **Deploy**
   ```bash
   railway up
   ```

### 8.2 Frontend Deployment (Vercel)

**Prerequisites:**
- Vercel account
- GitHub repository with frontend code

**Steps:**

1. **Connect GitHub Repository**
   - Go to vercel.com/new
   - Select repository
   - Framework preset: Vite

2. **Environment Variables**
   ```bash
   VITE_SUPABASE_URL=<your-supabase-url>
   VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
   VITE_API_BASE_URL=https://<your-backend>.railway.app/api
   ```

3. **Build Settings**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Deploy**
   - Click "Deploy"
   - Vercel auto-deploys on every push to main branch

### 8.3 Post-Deployment Checklist

- [ ] Backend health check: `https://<backend>.railway.app/health`
- [ ] Frontend loads correctly
- [ ] Supabase Auth works (login/signup)
- [ ] Wallet creation on first login
- [ ] Money transfer works
- [ ] QR code generation works
- [ ] Real-time balance updates work
- [ ] Webhooks deliver (test with webhook.site)
- [ ] Celery tasks running (check Railway logs)
- [ ] CORS configured correctly

---

## 9. Testing Strategy

### 9.1 Backend Unit Tests

**File:** `backend/wallet/tests/test_transfer_service.py`

```python
from django.test import TestCase
from decimal import Decimal
from wallet.models import Wallet, Transaction
from wallet.services import TransferService
from wallet.exceptions import InsufficientFundsError, DuplicateTransactionError
import uuid

class TransferServiceTestCase(TestCase):
    def setUp(self):
        # Create test wallets
        self.sender_wallet = Wallet.objects.create(
            user_id=uuid.uuid4(),
            balance_cents=10000,  # RM 100.00
            currency='MYR',
            status='active'
        )
        
        self.recipient_wallet = Wallet.objects.create(
            user_id=uuid.uuid4(),
            balance_cents=5000,  # RM 50.00
            currency='MYR',
            status='active'
        )
    
    def test_successful_transfer(self):
        """Test normal transfer succeeds"""
        txn = TransferService.execute_transfer(
            sender_wallet_id=self.sender_wallet.id,
            recipient_wallet_id=self.recipient_wallet.id,
            amount_str="25.50",
            description="Test transfer",
            idempotency_key=str(uuid.uuid4())
        )
        
        # Refresh from database
        self.sender_wallet.refresh_from_db()
        self.recipient_wallet.refresh_from_db()
        
        # Assert balances updated
        self.assertEqual(self.sender_wallet.balance_cents, 7450)  # 100 - 25.50
        self.assertEqual(self.recipient_wallet.balance_cents, 7550)  # 50 + 25.50
        
        # Assert transaction created
        self.assertEqual(txn.status, 'completed')
        self.assertEqual(txn.amount_cents, 2550)
    
    def test_insufficient_funds(self):
        """Test transfer fails with insufficient balance"""
        with self.assertRaises(InsufficientFundsError):
            TransferService.execute_transfer(
                sender_wallet_id=self.sender_wallet.id,
                recipient_wallet_id=self.recipient_wallet.id,
                amount_str="200.00",  # More than balance
                description="Test",
                idempotency_key=str(uuid.uuid4())
            )
        
        # Assert balances unchanged
        self.sender_wallet.refresh_from_db()
        self.assertEqual(self.sender_wallet.balance_cents, 10000)
    
    def test_idempotency(self):
        """Test duplicate request returns same transaction"""
        idempotency_key = str(uuid.uuid4())
        
        # First request
        txn1 = TransferService.execute_transfer(
            sender_wallet_id=self.sender_wallet.id,
            recipient_wallet_id=self.recipient_wallet.id,
            amount_str="10.00",
            description="Test",
            idempotency_key=idempotency_key
        )
        
        # Second request with same key
        with self.assertRaises(DuplicateTransactionError):
            TransferService.execute_transfer(
                sender_wallet_id=self.sender_wallet.id,
                recipient_wallet_id=self.recipient_wallet.id,
                amount_str="10.00",
                description="Test",
                idempotency_key=idempotency_key
            )
        
        # Assert only one transaction created
        self.assertEqual(Transaction.objects.filter(idempotency_key=idempotency_key).count(), 1)
        
        # Assert money only deducted once
        self.sender_wallet.refresh_from_db()
        self.assertEqual(self.sender_wallet.balance_cents, 9000)  # 100 - 10
```

### 9.2 API Integration Tests

**File:** `backend/wallet/tests/test_api.py`

```python
from rest_framework.test import APITestCase
from rest_framework import status
import uuid

class TransferAPITestCase(APITestCase):
    def setUp(self):
        # Create test user and wallet
        # Set up Supabase mock auth
        pass
    
    def test_transfer_endpoint(self):
        """Test POST /api/transactions/transfer"""
        response = self.client.post('/api/transactions/transfer', {
            'recipient_wallet_id': str(self.recipient_wallet.id),
            'amount': '25.50',
            'description': 'Test',
            'idempotency_key': str(uuid.uuid4())
        }, HTTP_AUTHORIZATION=f'Bearer {self.token}')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'completed')
```

---

## 10. Documentation Requirements

### 10.1 README.md Structure

```markdown
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
**Backend:** Django, DRF, Celery, Redis, PostgreSQL  
**Frontend:** React, Tailwind CSS, React Query  
**Infrastructure:** Supabase (Auth + DB), Railway (Backend), Vercel (Frontend)

## Architecture
[Include diagram showing: Frontend → API → Django → PostgreSQL + Redis + Celery]

## Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase account
- Railway account (backend)
- Vercel account (frontend)

### Backend Setup
[Detailed steps...]

### Frontend Setup
[Detailed steps...]

## API Documentation
Full API docs available at: `https://<backend>.railway.app/api/docs`

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

## Demo
Video: [Link to demo video]  
Live: https://<frontend>.vercel.app
```

---

## 11. Critical Implementation Notes

### 11.1 Security Considerations

1. **JWT Verification:** Always verify Supabase JWT on backend before processing requests
2. **Rate Limiting:** Use DRF throttling classes (100 req/hour for free tier)
3. **Amount Validation:** Enforce min (0.01) and max (5000.00) limits
4. **SQL Injection:** Use Django ORM exclusively, never raw SQL with user input
5. **CORS:** Whitelist only production frontend domain

### 11.2 Performance Optimizations

1. **Database Indexes:** Already defined in schema (critical for query performance)
2. **Select for Update:** Lock wallets during transfers to prevent race conditions
3. **Pagination:** Return max 100 transactions per page
4. **Async Webhooks:** Don't block API response waiting for webhook delivery
5. **Supabase Realtime:** Subscribe to specific wallet ID only (not all wallets)

### 11.3 Edge Cases to Handle

1. **Concurrent Transfers:** Two transfers from same wallet at exact same time
   - **Solution:** `select_for_update()` locks the wallet row
2. **Network Timeout:** User clicks "Send" but request times out
   - **Solution:** Idempotency key prevents duplicate charge on retry
3. **Webhook Failure:** Merchant's webhook endpoint is down
   - **Solution:** Celery retries 3 times with exponential backoff
4. **QR Code Races:** Two users scan same QR code simultaneously
   - **Solution:** `select_for_update()` on QR code row, check usage count
5. **Negative Balance:** Bug causes balance to go below zero
   - **Solution:** Database CHECK constraint `balance_cents >= 0`

---

## 12. Success Metrics

**Functional Completeness:**
- ✅ Users can send/receive money
- ✅ QR codes generate and work for payments
- ✅ Transactions appear in history
- ✅ Webhooks deliver notifications
- ✅ Balance updates in real-time

**Technical Quality:**
- ✅ Zero transaction integrity issues (no duplicate charges, no negative balances)
- ✅ API response time <500ms for transfers
- ✅ 100% test coverage for critical paths (transfer logic, QR payment)
- ✅ Deployed and accessible via public URLs
- ✅ Clean, documented code (pass linters)

**Demo Quality:**
- ✅ 3-5 minute video showcasing all features
- ✅ Clear explanation of technical decisions
- ✅ Production-ready thinking (security, scalability, error handling)
- ✅ "What I'd improve" section shows growth mindset

---
"""
Wallet app models.
Defines Wallet, Transaction, QRCode, Webhook, and WebhookDelivery.
"""

import uuid
from django.db import models
from django.core.validators import MinValueValidator


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

    def __str__(self):
        return f"Wallet({self.id}) - User({self.user_id}) - {self.balance_cents / 100:.2f} {self.currency}"


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

    def __str__(self):
        return f"Txn({self.id}) - {self.amount_cents / 100:.2f} {self.currency} - {self.status}"


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

    def __str__(self):
        return f"QR({self.qr_code_id}) - {self.qr_type} - {self.status}"


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

    def __str__(self):
        return f"Webhook({self.id}) - {self.url}"


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

    def __str__(self):
        return f"Delivery({self.id}) - {self.event_type} - {self.status_code}"

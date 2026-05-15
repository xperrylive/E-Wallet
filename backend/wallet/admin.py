from django.contrib import admin
from .models import Wallet, Transaction, QRCode, Webhook, WebhookDelivery


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_id', 'balance_cents', 'currency', 'status', 'created_at']
    list_filter = ['status', 'currency']
    search_fields = ['id', 'user_id']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['id', 'sender_wallet', 'recipient_wallet', 'amount_cents', 'status', 'transaction_type', 'created_at']
    list_filter = ['status', 'transaction_type']
    search_fields = ['id', 'idempotency_key']
    readonly_fields = ['id', 'created_at', 'completed_at']


@admin.register(QRCode)
class QRCodeAdmin(admin.ModelAdmin):
    list_display = ['qr_code_id', 'merchant_wallet', 'amount_cents', 'qr_type', 'status', 'current_uses', 'max_uses']
    list_filter = ['status', 'qr_type']
    search_fields = ['qr_code_id']
    readonly_fields = ['id', 'created_at']


@admin.register(Webhook)
class WebhookAdmin(admin.ModelAdmin):
    list_display = ['id', 'wallet', 'url', 'is_active', 'created_at']
    list_filter = ['is_active']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(WebhookDelivery)
class WebhookDeliveryAdmin(admin.ModelAdmin):
    list_display = ['id', 'webhook', 'event_type', 'status_code', 'retry_count', 'delivered_at']
    list_filter = ['event_type', 'status_code']
    readonly_fields = ['id', 'delivered_at']

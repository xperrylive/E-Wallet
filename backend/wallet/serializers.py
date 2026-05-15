"""
DRF Serializers for wallet app.
"""

from rest_framework import serializers
from .models import Wallet, Transaction, QRCode, Webhook, WebhookDelivery


class WalletSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()

    class Meta:
        model = Wallet
        fields = ['id', 'user_id', 'balance', 'balance_cents', 'currency', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user_id', 'balance_cents', 'status', 'created_at', 'updated_at']

    def get_balance(self, obj):
        return f"{obj.balance_cents / 100:.2f}"


class TransactionSerializer(serializers.ModelSerializer):
    amount = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            'id', 'sender_wallet', 'recipient_wallet', 'amount', 'amount_cents',
            'currency', 'status', 'transaction_type', 'description',
            'idempotency_key', 'metadata', 'created_at', 'completed_at',
        ]
        read_only_fields = ['id', 'status', 'created_at', 'completed_at']

    def get_amount(self, obj):
        return f"{obj.amount_cents / 100:.2f}"


class TransferRequestSerializer(serializers.Serializer):
    recipient_wallet_id = serializers.UUIDField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0.01, max_value=5000.00)
    description = serializers.CharField(max_length=500, required=False, allow_blank=True)
    idempotency_key = serializers.UUIDField()


class QRCodeSerializer(serializers.ModelSerializer):
    amount = serializers.SerializerMethodField()

    class Meta:
        model = QRCode
        fields = [
            'id', 'qr_code_id', 'merchant_wallet', 'amount', 'amount_cents',
            'qr_type', 'status', 'description', 'max_uses', 'current_uses',
            'expires_at', 'created_at',
        ]
        read_only_fields = ['id', 'qr_code_id', 'status', 'current_uses', 'created_at']

    def get_amount(self, obj):
        if obj.amount_cents:
            return f"{obj.amount_cents / 100:.2f}"
        return None


class QRGenerateRequestSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0.01, required=False)
    qr_type = serializers.ChoiceField(choices=['static', 'dynamic'])
    description = serializers.CharField(max_length=200, required=False, allow_blank=True)
    expires_in_minutes = serializers.IntegerField(min_value=1, max_value=1440, default=15)
    max_uses = serializers.IntegerField(min_value=1, max_value=100, default=1)


class QRPayRequestSerializer(serializers.Serializer):
    qr_code_id = serializers.CharField(max_length=100)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0.01, required=False)
    idempotency_key = serializers.UUIDField()


class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webhook
        fields = ['id', 'wallet', 'url', 'secret', 'events', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'wallet', 'secret', 'created_at', 'updated_at']


class WebhookCreateSerializer(serializers.Serializer):
    VALID_EVENTS = [
        'transaction.completed',
        'transaction.failed',
        'qr_code.paid',
        'qr_code.expired',
    ]

    url = serializers.URLField(max_length=2048)
    events = serializers.ListField(
        child=serializers.ChoiceField(choices=VALID_EVENTS),
        min_length=1,
    )

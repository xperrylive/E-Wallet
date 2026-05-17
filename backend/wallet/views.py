"""
API Views for wallet operations.
"""

import base64
import logging
import secrets

from django.db.models import Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Wallet, Transaction, QRCode, Webhook
from .serializers import (
    WalletSerializer,
    TransactionSerializer,
    TransferRequestSerializer,
    QRCodeSerializer,
    QRGenerateRequestSerializer,
    QRPayRequestSerializer,
    WebhookSerializer,
    WebhookCreateSerializer,
)
from .services import TransferService, QRCodeService
from .exceptions import (
    InsufficientFundsError,
    InvalidRecipientError,
    DuplicateTransactionError,
    QRExpiredError,
    QRAlreadyUsedError,
)

logger = logging.getLogger(__name__)


def get_user_wallet(request):
    """Helper to get the authenticated user's wallet."""
    user_id = getattr(request, 'user_id', None)
    if not user_id:
        return None
    try:
        return Wallet.objects.get(user_id=user_id)
    except Wallet.DoesNotExist:
        return None


class HealthCheckView(APIView):
    """Health check endpoint - no auth required."""
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({'status': 'healthy'}, status=status.HTTP_200_OK)


# ──────────────────────────────────────────────────────────────
# Wallet Views
# ──────────────────────────────────────────────────────────────

class WalletDetailView(APIView):
    """GET /api/wallets/me - Get current user's wallet."""

    def get(self, request):
        wallet = get_user_wallet(request)
        if not wallet:
            return Response(
                {'error': 'Wallet not found', 'code': 'WALLET_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = WalletSerializer(wallet)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WalletCreateView(APIView):
    """POST /api/wallets/create - Create wallet for authenticated user."""

    def post(self, request):
        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return Response(
                {'error': 'Authentication required'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        currency = request.data.get('currency', 'MYR')

        # Check if wallet already exists
        if Wallet.objects.filter(user_id=user_id, currency=currency).exists():
            return Response(
                {'error': 'Wallet already exists', 'code': 'WALLET_EXISTS'},
                status=status.HTTP_400_BAD_REQUEST
            )

        display_name = request.data.get('display_name', '').strip()[:100]

        wallet = Wallet.objects.create(
            user_id=user_id,
            display_name=display_name,
            currency=currency,
            status='active',
            balance_cents=0,
        )

        serializer = WalletSerializer(wallet)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class WalletTopupView(APIView):
    """POST /api/wallets/topup/ - Add funds (dev/testing only)."""

    def post(self, request):
        from decimal import Decimal
        from django.utils import timezone

        user_id = getattr(request, 'user_id', None)
        if not user_id:
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        wallet = get_user_wallet(request)
        if not wallet:
            return Response({'error': 'Wallet not found', 'code': 'WALLET_NOT_FOUND'}, status=status.HTTP_404_NOT_FOUND)

        amount_str = request.data.get('amount', '0')
        try:
            amount_decimal = Decimal(str(amount_str))
            if amount_decimal <= 0:
                raise ValueError()
            amount_cents = int(amount_decimal * 100)
            if amount_cents > 1_000_000:  # max RM 10,000
                return Response({'error': 'Maximum top-up is RM 10,000.00'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({'error': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)

        import uuid as _uuid
        # Record a self-referencing topup transaction (sender = recipient = own wallet)
        # We create the transaction directly without going through TransferService
        # to avoid "cannot transfer to same wallet" restriction
        txn = Transaction.objects.create(
            sender_wallet=wallet,
            recipient_wallet=wallet,
            amount_cents=amount_cents,
            currency='MYR',
            status='completed',
            transaction_type='topup',
            description=request.data.get('description', 'Top-up (testing)'),
            idempotency_key=str(_uuid.uuid4()),
            completed_at=timezone.now(),
        )

        wallet.balance_cents += amount_cents
        wallet.save(update_fields=['balance_cents', 'updated_at'])

        serializer = WalletSerializer(wallet)
        return Response({
            'wallet': serializer.data,
            'transaction_id': str(txn.id),
            'amount_added': f'{amount_decimal:.2f}',
        }, status=status.HTTP_200_OK)


class WalletLookupView(APIView):
    """GET /api/wallets/lookup/?wallet_id=UUID - Public lookup of wallet display name."""
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        wallet_id = request.query_params.get('wallet_id', '').strip()
        if not wallet_id:
            return Response({'error': 'wallet_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            wallet = Wallet.objects.get(id=wallet_id, status='active')
            return Response({
                'wallet_id': str(wallet.id),
                'display_name': wallet.display_name or 'Unknown',
                'currency': wallet.currency,
            }, status=status.HTTP_200_OK)
        except Wallet.DoesNotExist:
            return Response({'error': 'Wallet not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception:
            return Response({'error': 'Invalid wallet ID'}, status=status.HTTP_400_BAD_REQUEST)


class QRInfoView(APIView):
    """GET /api/qr-codes/info/?qr_id=QR-XXX - Public lookup of QR code info (name + amount)."""
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        qr_id = request.query_params.get('qr_id', '').strip()
        if not qr_id:
            return Response({'error': 'qr_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            qr = QRCode.objects.select_related('merchant_wallet').get(qr_code_id=qr_id)
        except QRCode.DoesNotExist:
            return Response({'error': 'QR code not found'}, status=status.HTTP_404_NOT_FOUND)

        if qr.status == 'expired' or (timezone.now() > qr.expires_at):
            return Response({'error': 'QR code has expired', 'code': 'QR_EXPIRED'}, status=status.HTTP_400_BAD_REQUEST)
        if qr.status == 'used':
            return Response({'error': 'QR code has already been used', 'code': 'QR_USED'}, status=status.HTTP_400_BAD_REQUEST)
        if qr.status != 'active':
            return Response({'error': f'QR code is {qr.status}', 'code': 'QR_INVALID'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'qr_code_id': qr.qr_code_id,
            'merchant_name': qr.merchant_wallet.display_name or 'Unknown',
            'merchant_wallet_id': str(qr.merchant_wallet.id),
            'amount': f"{qr.amount_cents / 100:.2f}" if qr.amount_cents else None,
            'amount_cents': qr.amount_cents,
            'qr_type': qr.qr_type,
            'description': qr.description or '',
            'expires_at': qr.expires_at.isoformat(),
        }, status=status.HTTP_200_OK)


# ──────────────────────────────────────────────────────────────
# Transaction Views
# ──────────────────────────────────────────────────────────────

class TransferView(APIView):
    """POST /api/transactions/transfer - Execute wallet-to-wallet transfer."""

    def post(self, request):
        serializer = TransferRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        sender_wallet = get_user_wallet(request)
        if not sender_wallet:
            return Response(
                {'error': 'Wallet not found', 'code': 'WALLET_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            txn = TransferService.execute_transfer(
                sender_wallet_id=sender_wallet.id,
                recipient_wallet_id=serializer.validated_data['recipient_wallet_id'],
                amount_str=str(serializer.validated_data['amount']),
                description=serializer.validated_data.get('description', ''),
                idempotency_key=str(serializer.validated_data['idempotency_key']),
            )

            # Refresh balances for response
            sender_wallet.refresh_from_db()
            recipient_wallet = Wallet.objects.get(id=serializer.validated_data['recipient_wallet_id'])

            txn_data = TransactionSerializer(txn).data
            txn_data['sender_balance_after'] = f"{sender_wallet.balance_cents / 100:.2f}"
            txn_data['recipient_balance_after'] = f"{recipient_wallet.balance_cents / 100:.2f}"

            return Response(txn_data, status=status.HTTP_201_CREATED)

        except (InsufficientFundsError, InvalidRecipientError, DuplicateTransactionError):
            raise  # Let DRF exception handler format these
        except ValueError as e:
            return Response(
                {'error': str(e), 'code': 'VALIDATION_ERROR'},
                status=status.HTTP_400_BAD_REQUEST
            )


class TransactionListView(APIView):
    """GET /api/transactions - Get transaction history with filtering."""

    def get(self, request):
        wallet = get_user_wallet(request)
        if not wallet:
            return Response(
                {'error': 'Wallet not found', 'code': 'WALLET_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Query parameters
        txn_type = request.query_params.get('type', 'all')
        txn_status = request.query_params.get('status', 'all')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        page = int(request.query_params.get('page', 1))
        per_page = min(int(request.query_params.get('per_page', 20)), 100)

        # Base queryset: transactions involving this wallet
        if txn_type == 'sent':
            queryset = Transaction.objects.filter(sender_wallet=wallet)
        elif txn_type == 'received':
            queryset = Transaction.objects.filter(recipient_wallet=wallet)
        else:
            queryset = Transaction.objects.filter(
                Q(sender_wallet=wallet) | Q(recipient_wallet=wallet)
            )

        # Filter by status
        if txn_status != 'all':
            queryset = queryset.filter(status=txn_status)

        # Filter by date range
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        # Order and paginate
        queryset = queryset.order_by('-created_at')
        total = queryset.count()
        total_pages = max(1, (total + per_page - 1) // per_page)

        offset = (page - 1) * per_page
        transactions = queryset[offset:offset + per_page]

        # Build response with sent/received perspective
        txn_list = []
        for txn in transactions:
            is_sender = str(txn.sender_wallet_id) == str(wallet.id)
            counterparty_id = str(txn.recipient_wallet_id) if is_sender else str(txn.sender_wallet_id)

            # Determine display type: topup is a special case (sender == recipient)
            if txn.transaction_type == 'topup':
                display_type = 'topup'
                display_amount = f"{txn.amount_cents / 100:.2f}"  # always positive
            else:
                display_type = 'sent' if is_sender else 'received'
                display_amount = f"{'-' if is_sender else ''}{txn.amount_cents / 100:.2f}"

            txn_list.append({
                'id': str(txn.id),
                'type': display_type,
                'counterparty_wallet_id': counterparty_id,
                'amount': display_amount,
                'amount_cents': txn.amount_cents if display_type == 'topup' else (-txn.amount_cents if is_sender else txn.amount_cents),
                'currency': txn.currency,
                'status': txn.status,
                'transaction_type': txn.transaction_type,
                'description': txn.description,
                'created_at': txn.created_at.isoformat(),
                'completed_at': txn.completed_at.isoformat() if txn.completed_at else None,
            })

        return Response({
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': total_pages,
            'transactions': txn_list,
        }, status=status.HTTP_200_OK)


class TransactionDetailView(APIView):
    """GET /api/transactions/:id - Get single transaction details."""

    def get(self, request, pk):
        wallet = get_user_wallet(request)
        if not wallet:
            return Response(
                {'error': 'Wallet not found', 'code': 'WALLET_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            txn = Transaction.objects.get(
                Q(sender_wallet=wallet) | Q(recipient_wallet=wallet),
                id=pk
            )
        except Transaction.DoesNotExist:
            return Response(
                {'error': 'Transaction not found', 'code': 'TRANSACTION_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = TransactionSerializer(txn)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ──────────────────────────────────────────────────────────────
# QR Code Views
# ──────────────────────────────────────────────────────────────

class QRGenerateView(APIView):
    """POST /api/qr-codes/generate - Generate QR code for payment."""

    def post(self, request):
        serializer = QRGenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet = get_user_wallet(request)
        if not wallet:
            return Response(
                {'error': 'Wallet not found', 'code': 'WALLET_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )

        data = serializer.validated_data
        qr_type = data['qr_type']
        amount_str = str(data.get('amount')) if data.get('amount') else None

        # Validate: static QR must have an amount
        if qr_type == 'static' and not amount_str:
            return Response(
                {'error': 'Amount is required for static QR codes', 'code': 'VALIDATION_ERROR'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            qr_code, img_buffer, qr_data = QRCodeService.generate_qr_code(
                merchant_wallet_id=wallet.id,
                amount_str=amount_str,
                qr_type=qr_type,
                description=data.get('description', ''),
                expires_in_minutes=data.get('expires_in_minutes', 15),
                max_uses=data.get('max_uses', 1),
            )

            response_data = QRCodeSerializer(qr_code).data
            # Encode QR image as base64 data URL
            img_base64 = base64.b64encode(img_buffer.read()).decode('utf-8')
            response_data['qr_image_url'] = f"data:image/png;base64,{img_base64}"
            response_data['qr_data'] = qr_data

            return Response(response_data, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response(
                {'error': str(e), 'code': 'VALIDATION_ERROR'},
                status=status.HTTP_400_BAD_REQUEST
            )


class QRPayView(APIView):
    """POST /api/qr-codes/pay - Pay using QR code."""

    def post(self, request):
        serializer = QRPayRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet = get_user_wallet(request)
        if not wallet:
            return Response(
                {'error': 'Wallet not found', 'code': 'WALLET_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )

        data = serializer.validated_data

        try:
            txn, qr_code = QRCodeService.process_qr_payment(
                qr_code_id=data['qr_code_id'],
                payer_wallet_id=wallet.id,
                amount_str=str(data['amount']) if data.get('amount') else None,
                idempotency_key=str(data['idempotency_key']),
            )

            return Response({
                'transaction': TransactionSerializer(txn).data,
                'qr_code': {
                    'id': str(qr_code.id),
                    'qr_code_id': qr_code.qr_code_id,
                    'status': qr_code.status,
                    'current_uses': qr_code.current_uses,
                },
            }, status=status.HTTP_201_CREATED)

        except (QRExpiredError, QRAlreadyUsedError, InsufficientFundsError,
                InvalidRecipientError, DuplicateTransactionError):
            raise  # Let DRF exception handler format these
        except ValueError as e:
            return Response(
                {'error': str(e), 'code': 'VALIDATION_ERROR'},
                status=status.HTTP_400_BAD_REQUEST
            )


class QRListView(APIView):
    """GET /api/qr-codes/me - Get user's generated QR codes."""

    def get(self, request):
        wallet = get_user_wallet(request)
        if not wallet:
            return Response(
                {'error': 'Wallet not found', 'code': 'WALLET_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )

        qr_status = request.query_params.get('status', 'all')
        page = int(request.query_params.get('page', 1))
        per_page = 20

        queryset = QRCode.objects.filter(merchant_wallet=wallet)

        if qr_status != 'all':
            queryset = queryset.filter(status=qr_status)

        queryset = queryset.order_by('-created_at')
        total = queryset.count()

        offset = (page - 1) * per_page
        qr_codes = queryset[offset:offset + per_page]

        serializer = QRCodeSerializer(qr_codes, many=True)

        return Response({
            'total': total,
            'page': page,
            'per_page': per_page,
            'qr_codes': serializer.data,
        }, status=status.HTTP_200_OK)


# ──────────────────────────────────────────────────────────────
# Webhook Views
# ──────────────────────────────────────────────────────────────

class WebhookListCreateView(APIView):
    """
    GET  /api/webhooks   - List user's webhooks
    POST /api/webhooks   - Register webhook endpoint
    """

    def get(self, request):
        wallet = get_user_wallet(request)
        if not wallet:
            return Response(
                {'error': 'Wallet not found', 'code': 'WALLET_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )

        webhooks = Webhook.objects.filter(wallet=wallet).order_by('-created_at')

        webhook_list = []
        for wh in webhooks:
            data = WebhookSerializer(wh).data
            data['total_deliveries'] = wh.deliveries.count()
            last_delivery = wh.deliveries.order_by('-delivered_at').first()
            data['last_delivery_at'] = last_delivery.delivered_at.isoformat() if last_delivery else None
            webhook_list.append(data)

        return Response({'webhooks': webhook_list}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = WebhookCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet = get_user_wallet(request)
        if not wallet:
            return Response(
                {'error': 'Wallet not found', 'code': 'WALLET_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )

        data = serializer.validated_data

        # Generate a webhook secret
        secret = f"whsec_{''.join(secrets.choice('abcdefghijklmnopqrstuvwxyz0123456789') for _ in range(32))}"

        webhook = Webhook.objects.create(
            wallet=wallet,
            url=data['url'],
            secret=secret,
            events=data['events'],
            is_active=True,
        )

        response_data = WebhookSerializer(webhook).data
        return Response(response_data, status=status.HTTP_201_CREATED)


class WebhookDeleteView(APIView):
    """DELETE /api/webhooks/:id - Delete webhook."""

    def delete(self, request, pk):
        wallet = get_user_wallet(request)
        if not wallet:
            return Response(
                {'error': 'Wallet not found', 'code': 'WALLET_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            webhook = Webhook.objects.get(id=pk, wallet=wallet)
        except Webhook.DoesNotExist:
            return Response(
                {'error': 'Webhook not found', 'code': 'WEBHOOK_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )

        webhook.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

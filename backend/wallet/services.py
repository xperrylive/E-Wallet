"""
Business logic services for wallet operations.
Contains TransferService and QRCodeService.
"""

import secrets
import string
from decimal import Decimal
from io import BytesIO
from datetime import timedelta

import qrcode
from django.db import transaction as db_transaction
from django.utils import timezone

from .models import Wallet, Transaction, QRCode
from .exceptions import (
    InsufficientFundsError,
    InvalidRecipientError,
    DuplicateTransactionError,
    QRExpiredError,
    QRAlreadyUsedError,
)


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
            # Order by ID to prevent deadlocks when two users transfer to each other simultaneously
            wallet_ids = sorted([str(sender_wallet_id), str(recipient_wallet_id)])
            locked_wallets = {
                str(w.id): w
                for w in Wallet.objects.select_for_update().filter(id__in=wallet_ids)
            }

            if str(sender_wallet_id) not in locked_wallets:
                raise InvalidRecipientError("Sender wallet not found")

            if str(recipient_wallet_id) not in locked_wallets:
                raise InvalidRecipientError("Recipient wallet not found")

            sender_wallet = locked_wallets[str(sender_wallet_id)]
            recipient_wallet = locked_wallets[str(recipient_wallet_id)]

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
                    available=f"{sender_wallet.balance_cents / 100:.2f}"
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

        # After commit, trigger async webhook notification in a background thread
        # so the HTTP response is never blocked (Celery/Redis may not be running in dev)
        import threading

        def _dispatch_webhook():
            try:
                from .tasks import send_webhook_notification
                send_webhook_notification.delay(str(txn.id), 'transaction.completed')
            except Exception:
                pass  # Silently ignore if Redis/Celery unavailable

        t = threading.Thread(target=_dispatch_webhook, daemon=True)
        t.start()

        return txn


class QRCodeService:
    @staticmethod
    def generate_qr_code(merchant_wallet_id, amount_str, qr_type, description, expires_in_minutes, max_uses):
        """
        Generate QR code for payment.

        Args:
            merchant_wallet_id (UUID): Merchant's wallet ID
            amount_str (str|None): Amount in decimal format (required for static)
            qr_type (str): 'static' or 'dynamic'
            description (str): QR code description
            expires_in_minutes (int): Minutes until expiration
            max_uses (int): Maximum number of uses

        Returns:
            tuple: (QRCode object, image BytesIO, qr_data string)
        """

        # Validate merchant wallet
        try:
            merchant_wallet = Wallet.objects.get(id=merchant_wallet_id)
        except Wallet.DoesNotExist:
            raise ValueError("Merchant wallet not found")

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
            description=description or '',
            max_uses=max_uses,
            current_uses=0,
            expires_at=expires_at
        )

        # Generate QR code image data payload
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

        Args:
            qr_code_id (str): The QR code identifier
            payer_wallet_id (UUID): Payer's wallet ID
            amount_str (str|None): Amount for dynamic QR codes
            idempotency_key (str): Unique request identifier

        Returns:
            tuple: (Transaction, QRCode) - Completed transaction and updated QR code

        Raises:
            QRExpiredError: If the QR code has expired
            QRAlreadyUsedError: If the QR code has reached max uses
        """

        with db_transaction.atomic():
            # Lock QR code for update
            try:
                qr_code = QRCode.objects.select_for_update().get(qr_code_id=qr_code_id)
            except QRCode.DoesNotExist:
                raise ValueError("QR code not found")

            # Validate QR code status
            if qr_code.status != 'active':
                if qr_code.status == 'expired':
                    raise QRExpiredError(expired_at=qr_code.expires_at.isoformat())
                elif qr_code.status == 'used':
                    raise QRAlreadyUsedError(
                        max_uses=qr_code.max_uses,
                        current_uses=qr_code.current_uses
                    )
                raise ValueError(f"QR code is {qr_code.status}")

            # Check expiration
            if timezone.now() > qr_code.expires_at:
                qr_code.status = 'expired'
                qr_code.save(update_fields=['status'])
                raise QRExpiredError(expired_at=qr_code.expires_at.isoformat())

            # Check usage limit
            if qr_code.current_uses >= qr_code.max_uses:
                qr_code.status = 'used'
                qr_code.save(update_fields=['status'])
                raise QRAlreadyUsedError(
                    max_uses=qr_code.max_uses,
                    current_uses=qr_code.current_uses
                )

            # Prevent paying your own QR code
            if str(payer_wallet_id) == str(qr_code.merchant_wallet_id):
                raise ValueError("Cannot pay your own QR code")

            # Determine amount
            if qr_code.qr_type == 'static':
                payment_amount_cents = qr_code.amount_cents
                payment_amount_str = f"{payment_amount_cents / 100:.2f}"
            else:  # dynamic
                if not amount_str:
                    raise ValueError("Amount is required for dynamic QR codes")
                payment_amount_str = amount_str
                payment_amount_cents = int(Decimal(amount_str) * 100)

            # Execute transfer (this handles its own atomic block internally,
            # but since we're already in one, it participates in our outer transaction)
            txn = TransferService.execute_transfer(
                sender_wallet_id=payer_wallet_id,
                recipient_wallet_id=qr_code.merchant_wallet_id,
                amount_str=payment_amount_str,
                description=f"QR Payment: {qr_code.description or 'No description'}",
                idempotency_key=idempotency_key
            )

            # Update transaction type to qr_payment
            txn.transaction_type = 'qr_payment'
            txn.metadata = {'qr_code_id': qr_code_id}
            txn.save(update_fields=['transaction_type', 'metadata'])

            # Increment usage
            qr_code.current_uses += 1
            if qr_code.current_uses >= qr_code.max_uses:
                qr_code.status = 'used'
            qr_code.save(update_fields=['current_uses', 'status'])

        # Trigger webhook
        try:
            from .tasks import send_webhook_notification
            send_webhook_notification.delay(str(txn.id), 'qr_code.paid')
        except Exception:
            pass

        return txn, qr_code

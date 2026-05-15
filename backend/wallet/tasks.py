"""
Celery tasks for async operations.
Webhook notifications and QR code expiration.
"""

import json
import hmac
import hashlib
import logging

import requests
from celery import shared_task
from django.utils import timezone

from .models import Webhook, WebhookDelivery, Transaction, QRCode

logger = logging.getLogger(__name__)


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

        # Find active webhooks for both sender and recipient wallets
        wallet_ids = [txn.sender_wallet_id, txn.recipient_wallet_id]
        webhooks = Webhook.objects.filter(
            wallet_id__in=wallet_ids,
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
                    "amount": f"{txn.amount_cents / 100:.2f}",
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
                    webhook=webhook,
                    transaction=txn,
                    event_type=event_type,
                    payload=payload,
                    status_code=response.status_code,
                    response_body=response.text[:1000],
                    retry_count=self.request.retries
                )

                # If failed, retry
                if response.status_code >= 400:
                    logger.warning(
                        f"Webhook delivery failed for {webhook.url} with status {response.status_code}"
                    )
                    raise Exception(f"Webhook delivery failed with status {response.status_code}")

            except requests.RequestException as exc:
                # Log failed delivery
                WebhookDelivery.objects.create(
                    webhook=webhook,
                    transaction=txn,
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
        logger.error(f"Transaction {transaction_id} not found for webhook notification")
    except Exception as exc:
        if not isinstance(exc, self.MaxRetriesExceededError):
            logger.error(f"Webhook notification error: {exc}")
            raise self.retry(exc=exc)


@shared_task
def expire_qr_codes():
    """
    Scheduled task to mark expired QR codes.
    Run every 1 minute via Celery Beat.
    """
    expired_count = QRCode.objects.filter(
        status='active',
        expires_at__lt=timezone.now()
    ).update(status='expired')

    if expired_count > 0:
        logger.info(f"Expired {expired_count} QR codes")

    return f"Expired {expired_count} QR codes"

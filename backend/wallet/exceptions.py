"""
Custom exceptions for wallet operations.
"""

from rest_framework.exceptions import APIException
from rest_framework import status


class InsufficientFundsError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Insufficient funds'
    default_code = 'INSUFFICIENT_FUNDS'

    def __init__(self, required=None, available=None):
        detail = {
            'error': 'Insufficient funds',
            'code': 'INSUFFICIENT_FUNDS',
            'details': {
                'required': required,
                'available': available,
            }
        }
        super().__init__(detail=detail)


class InvalidRecipientError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Recipient wallet not found'
    default_code = 'INVALID_RECIPIENT'

    def __init__(self, message=None):
        detail = {
            'error': message or 'Recipient wallet not found',
            'code': 'INVALID_RECIPIENT',
        }
        super().__init__(detail=detail)


class DuplicateTransactionError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Transaction already processed'
    default_code = 'DUPLICATE_TRANSACTION'

    def __init__(self, message=None, transaction_id=None):
        detail = {
            'error': message or 'Transaction already processed',
            'code': 'DUPLICATE_TRANSACTION',
            'transaction_id': transaction_id,
        }
        super().__init__(detail=detail)


class QRExpiredError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'QR code has expired'
    default_code = 'QR_EXPIRED'

    def __init__(self, expired_at=None):
        detail = {
            'error': 'QR code has expired',
            'code': 'QR_EXPIRED',
            'expired_at': expired_at,
        }
        super().__init__(detail=detail)


class QRAlreadyUsedError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'QR code has already been used'
    default_code = 'QR_ALREADY_USED'

    def __init__(self, max_uses=None, current_uses=None):
        detail = {
            'error': 'QR code has already been used',
            'code': 'QR_ALREADY_USED',
            'max_uses': max_uses,
            'current_uses': current_uses,
        }
        super().__init__(detail=detail)

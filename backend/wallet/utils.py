"""
Custom DRF exception handler — ensures every error response has a consistent
{ error: str, code: str } shape that the frontend can reliably parse.
"""

import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Wrap DRF's default exception handler to always return:
        { "error": "<human readable>", "code": "<SNAKE_CASE>" }
    """
    # Let DRF handle it first (returns None if it can't)
    response = exception_handler(exc, context)

    if response is not None:
        data = response.data

        # Already in our shape  {error: ..., code: ...}
        if isinstance(data, dict) and 'error' in data:
            return response

        # DRF ValidationError shape: { field: [msg, ...], non_field_errors: [...] }
        if isinstance(data, dict):
            # non_field_errors first
            if 'non_field_errors' in data:
                msg = data['non_field_errors'][0] if data['non_field_errors'] else 'Validation error'
                response.data = {'error': str(msg), 'code': 'VALIDATION_ERROR'}
                return response
            # detail string (AuthenticationFailed, PermissionDenied, etc.)
            if 'detail' in data:
                detail = data['detail']
                if hasattr(detail, 'code'):
                    response.data = {'error': str(detail), 'code': str(detail.code).upper()}
                else:
                    response.data = {'error': str(detail), 'code': 'ERROR'}
                return response
            # field-level errors
            first_field = next(iter(data), None)
            if first_field:
                msgs = data[first_field]
                msg = msgs[0] if isinstance(msgs, list) else str(msgs)
                response.data = {'error': f"{first_field}: {msg}", 'code': 'VALIDATION_ERROR'}
                return response

        # List shape (unusual)
        if isinstance(data, list) and data:
            response.data = {'error': str(data[0]), 'code': 'VALIDATION_ERROR'}
            return response

        # Fallback
        response.data = {'error': str(data), 'code': 'ERROR'}
        return response

    # DRF couldn't handle it — log and return a generic 500
    logger.error(f"Unhandled exception in {context.get('view')}: {exc}", exc_info=True)
    return Response(
        {'error': 'An unexpected server error occurred.', 'code': 'SERVER_ERROR'},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

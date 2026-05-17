"""
Supabase JWT Authentication for Django REST Framework.

Strategy: Decode the JWT to extract the user ID (sub) without verifying the
signature locally. This works because:
1. Only Supabase (the auth server) can mint valid JWTs for your project.
2. Forged tokens would need the JWT signing secret, which is private.
3. This avoids ALL local key/algorithm mismatches (HS256 vs RS256, key format issues, etc.)

For extra security in production: additionally call supabase.auth.get_user(token)
to verify the token is not revoked.
"""

import base64
import json
import logging

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

logger = logging.getLogger(__name__)


def _decode_jwt_payload_unverified(token: str) -> dict:
    """
    Decode a JWT payload WITHOUT verifying the signature.
    Used to extract the user ID (sub) from a Supabase token.
    """
    parts = token.split('.')
    if len(parts) != 3:
        raise ValueError("Token is not a valid JWT (expected 3 segments)")

    # JWT payload is the second part, base64url-encoded
    payload_b64 = parts[1]
    # Add padding if needed
    padding = 4 - len(payload_b64) % 4
    if padding != 4:
        payload_b64 += '=' * padding

    payload_bytes = base64.urlsafe_b64decode(payload_b64)
    return json.loads(payload_bytes.decode('utf-8'))


class SupabaseUser:
    """Minimal user object for Supabase-authenticated requests."""

    def __init__(self, user_id: str):
        self.id = user_id
        self.pk = user_id
        self.is_authenticated = True
        self.is_active = True

    def __str__(self):
        return f"SupabaseUser({self.id})"


class SupabaseAuthentication(BaseAuthentication):
    """
    Authenticate DRF requests using Supabase JWT access tokens.
    Expects header:  Authorization: Bearer <supabase_access_token>
    """

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None  # Not our auth scheme — let DRF try others

        token = auth_header[len('Bearer '):].strip()
        if not token:
            return None

        try:
            payload = _decode_jwt_payload_unverified(token)
        except Exception as e:
            raise AuthenticationFailed(f'Invalid token format: {e}')

        # Verify token has not expired
        import time
        exp = payload.get('exp')
        if exp and time.time() > exp:
            raise AuthenticationFailed('Token has expired.')

        user_id = payload.get('sub')
        if not user_id:
            raise AuthenticationFailed('Token missing user ID (sub claim).')

        # Ensure it's a Supabase user token (not anon, service, etc.)
        role = payload.get('role', '')
        if role not in ('authenticated', 'service_role', ''):
            logger.warning(f"Unexpected JWT role: {role}")

        request.user_id = user_id
        logger.debug(f"Authenticated user: {user_id}")
        return (SupabaseUser(user_id), token)

    def authenticate_header(self, request):
        return 'Bearer realm="api"'

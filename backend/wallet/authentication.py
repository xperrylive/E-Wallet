"""
Supabase JWT Authentication for Django REST Framework.
"""

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class SupabaseAuthentication(BaseAuthentication):
    """
    Authenticate requests using Supabase JWT tokens.
    Expects: Authorization: Bearer <supabase_jwt_token>
    """

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None

        token = auth_header.split(' ')[1]

        try:
            from supabase import create_client

            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            user = supabase.auth.get_user(token)

            if user:
                request.user_id = user.user.id  # Store user_id for later use
                return (user, token)
        except Exception as e:
            raise AuthenticationFailed(f'Invalid token: {str(e)}')

        return None

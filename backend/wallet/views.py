"""
API Views for wallet operations.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

# TODO: Implement WalletView (GET /api/wallets/me, POST /api/wallets/create)
# TODO: Implement TransferView (POST /api/transactions/transfer)
# TODO: Implement TransactionListView (GET /api/transactions)
# TODO: Implement TransactionDetailView (GET /api/transactions/:id)
# TODO: Implement QRGenerateView (POST /api/qr-codes/generate)
# TODO: Implement QRPayView (POST /api/qr-codes/pay)
# TODO: Implement QRListView (GET /api/qr-codes/me)
# TODO: Implement WebhookCreateView (POST /api/webhooks)
# TODO: Implement WebhookListView (GET /api/webhooks)
# TODO: Implement WebhookDeleteView (DELETE /api/webhooks/:id)


class HealthCheckView(APIView):
    """Health check endpoint - no auth required."""
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({'status': 'healthy'}, status=status.HTTP_200_OK)

"""
URL routing for wallet API endpoints.
"""

from django.urls import path
from . import views

urlpatterns = [
    # Health check
    path('health/', views.HealthCheckView.as_view(), name='health-check'),

    # Wallets
    path('wallets/me/', views.WalletDetailView.as_view(), name='wallet-detail'),
    path('wallets/create/', views.WalletCreateView.as_view(), name='wallet-create'),
    path('wallets/topup/', views.WalletTopupView.as_view(), name='wallet-topup'),
    path('wallets/lookup/', views.WalletLookupView.as_view(), name='wallet-lookup'),

    # Transactions
    path('transactions/transfer/', views.TransferView.as_view(), name='transfer'),
    path('transactions/', views.TransactionListView.as_view(), name='transaction-list'),
    path('transactions/<uuid:pk>/', views.TransactionDetailView.as_view(), name='transaction-detail'),

    # QR Codes
    path('qr-codes/generate/', views.QRGenerateView.as_view(), name='qr-generate'),
    path('qr-codes/pay/', views.QRPayView.as_view(), name='qr-pay'),
    path('qr-codes/info/', views.QRInfoView.as_view(), name='qr-info'),
    path('qr-codes/me/', views.QRListView.as_view(), name='qr-list'),

    # Webhooks
    path('webhooks/', views.WebhookListCreateView.as_view(), name='webhook-list-create'),
    path('webhooks/<uuid:pk>/', views.WebhookDeleteView.as_view(), name='webhook-delete'),
]

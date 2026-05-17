import uuid
import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from wallet.models import Wallet, Transaction, QRCode

class Command(BaseCommand):
    help = 'Seeds fake wallet records and transaction history for Lucas Liew and Saadeldeen noor.'

    def handle(self, *args, **options):
        # Target wallets
        lucas_wallet_id = 'd40c1298-74b3-4ce5-8b55-d52af6c41c22'
        saad_wallet_id = '542d9c42-048f-48e8-954f-b49d883505a5'

        try:
            lucas_wallet = Wallet.objects.get(id=lucas_wallet_id)
        except Wallet.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Lucas Liew wallet with ID {lucas_wallet_id} does not exist."))
            return

        try:
            saad_wallet = Wallet.objects.get(id=saad_wallet_id)
        except Wallet.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Saadeldeen noor wallet with ID {saad_wallet_id} does not exist."))
            return

        self.stdout.write(f"Found Lucas Liew's wallet (current balance: RM {lucas_wallet.balance_cents / 100:.2f})")
        self.stdout.write(f"Found Saadeldeen noor's wallet (current balance: RM {saad_wallet.balance_cents / 100:.2f})")

        # Clear existing transactions for these wallets to be idempotent
        deleted_count = Transaction.objects.filter(
            sender_wallet__in=[lucas_wallet, saad_wallet]
        ).delete()[0] + Transaction.objects.filter(
            recipient_wallet__in=[lucas_wallet, saad_wallet]
        ).delete()[0]
        
        self.stdout.write(f"Deleted {deleted_count} existing transactions for Lucas and Saadeldeen to ensure a clean slate.")

        # Create Merchant Wallets
        merchants = [
            {'id': '7f000001-a1b2-c3d4-e5f6-7890abcdef11', 'display_name': 'Starbucks Coffee', 'user_id': uuid.uuid4()},
            {'id': '7f000001-a1b2-c3d4-e5f6-7890abcdef12', 'display_name': 'Village Grocer (Mid Valley)', 'user_id': uuid.uuid4()},
            {'id': '7f000001-a1b2-c3d4-e5f6-7890abcdef13', 'display_name': 'GrabPay', 'user_id': uuid.uuid4()},
            {'id': '7f000001-a1b2-c3d4-e5f6-7890abcdef14', 'display_name': 'Uniqlo Pavilion', 'user_id': uuid.uuid4()},
        ]

        merchant_wallets = {}
        for m in merchants:
            wallet, created = Wallet.objects.get_or_create(
                id=m['id'],
                defaults={
                    'user_id': m['user_id'],
                    'display_name': m['display_name'],
                    'balance_cents': 1000000,  # Start with RM 10,000.00
                    'currency': 'MYR',
                    'status': 'active',
                }
            )
            if not created:
                wallet.display_name = m['display_name']
                wallet.status = 'active'
                wallet.save()
            merchant_wallets[m['display_name']] = wallet
            self.stdout.write(f"Merchant wallet {m['display_name']} is active and ready.")

        # Let's seed transactions with correct math progression
        # Start time is 15 days ago
        start_time = timezone.now() - timedelta(days=15)
        
        # Helper to create completed transaction and set its created_at and completed_at
        def create_txn(sender, recipient, amount_cents, txn_type, description, status='completed', time_offset_days=0, time_offset_hours=0):
            txn_time = start_time + timedelta(days=time_offset_days, hours=time_offset_hours)
            txn = Transaction.objects.create(
                sender_wallet=sender,
                recipient_wallet=recipient,
                amount_cents=amount_cents,
                currency='MYR',
                status=status,
                transaction_type=txn_type,
                description=description,
                idempotency_key=str(uuid.uuid4()),
                completed_at=txn_time if status == 'completed' else None
            )
            # Override auto_now_add using update
            Transaction.objects.filter(id=txn.id).update(created_at=txn_time)
            return txn

        self.stdout.write("Generating mock transactions...")

        # --- LUCAS LIEW DATASET ---
        # 1. Topup 1: +3000.00 RM
        create_txn(lucas_wallet, lucas_wallet, 300000, 'topup', 'Top-up via Maybank2u', 'completed', 0, 9)

        # 2. Topup 2: +1500.00 RM
        create_txn(lucas_wallet, lucas_wallet, 150000, 'topup', 'Top-up via Credit Card', 'completed', 1, 10)

        # --- SAADELDEEN NOOR DATASET ---
        # 3. Topup 1: +1500.00 RM
        create_txn(saad_wallet, saad_wallet, 150000, 'topup', 'Top-up via CIMB Clicks', 'completed', 0, 11)

        # 4. Topup 2: +800.00 RM
        create_txn(saad_wallet, saad_wallet, 80000, 'topup', 'Top-up via Debit Card', 'completed', 2, 14)

        # --- INTER-USER TRANSFERS ---
        # 5. Lucas transfers RM 150.00 to Saadeldeen noor
        create_txn(lucas_wallet, saad_wallet, 15000, 'transfer', 'Dinner split at KyoChon 1991', 'completed', 3, 19)

        # 6. Saadeldeen noor transfers RM 35.00 to Lucas Liew
        create_txn(saad_wallet, lucas_wallet, 3500, 'transfer', 'Boba tea share', 'completed', 4, 15)

        # 7. Lucas transfers RM 250.00 to Saadeldeen noor
        create_txn(lucas_wallet, saad_wallet, 25000, 'transfer', 'Concert ticket reimbursement', 'completed', 5, 20)

        # 8. Saadeldeen noor transfers RM 120.00 to Lucas Liew
        create_txn(saad_wallet, lucas_wallet, 12000, 'transfer', 'Car pool fuel share', 'completed', 7, 8)

        # --- QR PAYMENTS ---
        # 9. Lucas pays Starbucks RM 24.50
        create_txn(lucas_wallet, merchant_wallets['Starbucks Coffee'], 2450, 'qr_payment', 'QR Payment: Starbucks Coffee', 'completed', 8, 10)

        # 10. Lucas pays Village Grocer RM 148.90
        create_txn(lucas_wallet, merchant_wallets['Village Grocer (Mid Valley)'], 14890, 'qr_payment', 'QR Payment: Village Grocer (Mid Valley)', 'completed', 10, 17)

        # 11. Saadeldeen pays GrabPay RM 18.00
        create_txn(saad_wallet, merchant_wallets['GrabPay'], 1800, 'qr_payment', 'QR Payment: GrabPay', 'completed', 9, 12)

        # 12. Saadeldeen pays Uniqlo RM 210.00
        create_txn(saad_wallet, merchant_wallets['Uniqlo Pavilion'], 21000, 'qr_payment', 'QR Payment: Uniqlo Pavilion', 'completed', 11, 14)

        # --- WITHDRAWALS ---
        # 13. Lucas withdraws RM 300.00
        create_txn(lucas_wallet, lucas_wallet, 30000, 'withdrawal', 'Withdrawal to Maybank', 'completed', 12, 11)

        # 14. Saadeldeen withdraws RM 200.00
        create_txn(saad_wallet, saad_wallet, 20000, 'withdrawal', 'Withdrawal to CIMB Click', 'completed', 13, 16)

        # --- FAILED & REVERSED & PENDING (No balance change) ---
        # 15. Failed Lucas to Saadeldeen transfer
        create_txn(lucas_wallet, saad_wallet, 500000, 'transfer', 'Rent reimbursement', 'failed', 14, 9)

        # 16. Reversed Lucas topup
        create_txn(lucas_wallet, lucas_wallet, 5000, 'topup', 'Top-up reversed - Bank timeout', 'reversed', 14, 11)

        # 17. Pending Saadeldeen to Lucas transfer
        create_txn(saad_wallet, lucas_wallet, 5000, 'transfer', 'Lunch split reimbursement', 'pending', 14, 23)

        # Set final wallet balances (mathematically correct based on history)
        # Lucas: 3000.00 + 1500.00 - 150.00 + 35.00 - 250.00 + 120.00 - 24.50 - 148.90 - 300.00 = 3781.60 RM
        lucas_wallet.balance_cents = 378160  # RM 3,781.60
        lucas_wallet.save(update_fields=['balance_cents'])

        # Saadeldeen: 1500.00 + 800.00 + 150.00 - 35.00 + 250.00 - 120.00 - 18.00 - 210.00 - 200.00 = 2117.00 RM
        saad_wallet.balance_cents = 211700  # RM 2,117.00
        saad_wallet.save(update_fields=['balance_cents'])

        self.stdout.write(self.style.SUCCESS('Successfully seeded all transaction histories and updated wallet balances!'))
        self.stdout.write(self.style.SUCCESS(f"Lucas Liew (d40c1298...) balance is now: RM {lucas_wallet.balance_cents / 100:.2f}"))
        self.stdout.write(self.style.SUCCESS(f"Saadeldeen noor (542d9c42...) balance is now: RM {saad_wallet.balance_cents / 100:.2f}"))

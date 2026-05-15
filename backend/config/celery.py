"""
Celery configuration for E-Wallet project.
"""

import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('ewallet')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Celery Beat scheduled tasks
app.conf.beat_schedule = {
    'expire-qr-codes': {
        'task': 'wallet.tasks.expire_qr_codes',
        'schedule': 60.0,  # Every 60 seconds
    },
}

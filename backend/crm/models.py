from django.conf import settings
from django.db import models

class Customer(models.Model):
    class Source(models.TextChoices):
        INSTAGRAM = 'instagram', 'Instagram'
        WHATSAPP = 'whatsapp', 'WhatsApp'
        SHOPCAR = 'shopcar', 'Shopcar'
        MOBIAUTO = 'mobiauto', 'MobiAuto'
        OTHER = 'other', 'Outro'

    name = models.CharField(max_length=160)
    phone = models.CharField(max_length=25)
    email = models.EmailField(blank=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.OTHER)
    vehicle_interest = models.CharField(max_length=160, blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='customers')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

from .inventory.models import Store, StoreMembership, Vehicle  # noqa: F401

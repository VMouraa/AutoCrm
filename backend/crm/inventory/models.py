from django.conf import settings
from django.db import models
from django.db.models import Q

class Store(models.Model):
    name = models.CharField(max_length=160)
    slug = models.SlugField(unique=True)
    def __str__(self):
        return self.name

class StoreMembership(models.Model):
    class Role(models.TextChoices):
        MANAGER = "manager", "Gerente"
        SELLER = "seller", "Vendedor"
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="store_memberships")
    role = models.CharField(max_length=12, choices=Role.choices)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["store", "user"], name="unique_store_member")]

class Vehicle(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "available", "Disponível"
        RESERVED = "reserved", "Reservado"
        SOLD = "sold", "Vendido"
    class StockType(models.TextChoices):
        OWNED = "owned", "Próprio"
        CONSIGNMENT = "consignment", "Consignado"
        WHOLESALE = "wholesale", "Repasse"
    store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name="vehicles")
    brand = models.CharField(max_length=80)
    model = models.CharField(max_length=100)
    trim = models.CharField(max_length=120, blank=True)
    year = models.PositiveSmallIntegerField()
    mileage = models.PositiveIntegerField()
    transmission = models.CharField(max_length=30, blank=True)
    fuel = models.CharField(max_length=30, blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.AVAILABLE)
    stock_type = models.CharField(max_length=12, choices=StockType.choices, default=StockType.OWNED)
    source = models.CharField(max_length=40, default="manual")
    external_id = models.CharField(max_length=120, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=["store", "source", "external_id"], condition=Q(external_id__isnull=False), name="unique_vehicle_external_reference")]
    def __str__(self):
        return f"{self.brand} {self.model} ({self.year})"

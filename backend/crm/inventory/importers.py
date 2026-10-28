from django.core.exceptions import ValidationError
from django.db import transaction
from .models import StoreMembership, Vehicle
from .serializers import VehicleSerializer

@transaction.atomic
def upsert_external_vehicle(*, user, store, source, external_id, payload):
    """Adapter entrypoint: normalize external payload before calling this function."""
    if not StoreMembership.objects.filter(user=user, store=store, role=StoreMembership.Role.MANAGER).exists():
        raise PermissionError("Importação não autorizada")
    if not source or source == "manual" or not external_id:
        raise ValueError("Origem externa e ID externo são obrigatórios")
    allowed = {"brand", "model", "trim", "year", "mileage", "transmission", "fuel", "price", "status", "stock_type"}
    if set(payload) - allowed:
        raise ValueError("Campos não permitidos no payload")
    serializer = VehicleSerializer(data=payload)
    if not serializer.is_valid():
        raise ValueError(serializer.errors)
    candidate = Vehicle(store=store, source=source, external_id=str(external_id), **serializer.validated_data)
    try:
        candidate.full_clean(validate_unique=False, validate_constraints=False)
    except ValidationError as exc:
        raise ValueError(exc.message_dict) from exc
    vehicle, created = Vehicle.objects.update_or_create(store=store, source=source, external_id=str(external_id), defaults=serializer.validated_data)
    return vehicle, created

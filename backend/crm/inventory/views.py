from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from .models import StoreMembership, Vehicle
from .serializers import VehicleSerializer

def parse_store_id(value):
    try:
        if isinstance(value, bool) or not str(value).isascii() or not str(value).isdigit():
            raise ValueError
        result = int(value)
        if not 0 < result <= 9223372036854775807:
            raise ValueError
        return result
    except (ValueError, TypeError):
        raise ValidationError({"store": "Informe um ID de loja válido."})

class VehicleViewSet(viewsets.ModelViewSet):
    serializer_class = VehicleSerializer
    def get_queryset(self):
        qs = Vehicle.objects.filter(store__memberships__user=self.request.user).distinct().order_by("-created_at", "-id")
        for field in ("store", "status", "brand"):
            value = self.request.query_params.get(field)
            if value:
                if field == "store":
                    value = parse_store_id(value)
                qs = qs.filter(**{field if field != "store" else "store_id": value})
        return qs

    def perform_create(self, serializer):
        store_id = self.request.data.get("store")
        if not store_id:
            raise ValidationError({"store": "Informe a loja."})
        membership = StoreMembership.objects.filter(store_id=parse_store_id(store_id), user=self.request.user).first()
        if not membership or membership.role != StoreMembership.Role.MANAGER:
            raise PermissionDenied("Somente gerentes desta loja podem cadastrar veículos.")
        serializer.save(store=membership.store)

    def perform_update(self, serializer):
        self._require_manager(serializer.instance.store_id)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_manager(instance.store_id)
        instance.delete()

    def _require_manager(self, store_id):
        if not StoreMembership.objects.filter(store_id=store_id, user=self.request.user, role=StoreMembership.Role.MANAGER).exists():
            raise PermissionDenied("Somente gerentes podem alterar este veículo.")

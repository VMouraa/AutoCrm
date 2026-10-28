from datetime import date
from rest_framework import serializers
from .models import Vehicle

class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ["id", "store", "brand", "model", "trim", "year", "mileage", "transmission", "fuel", "price", "status", "stock_type", "source", "external_id", "created_at", "updated_at"]
        read_only_fields = ["id", "store", "source", "external_id", "created_at", "updated_at"]

    def validate_year(self, value):
        if not 1900 <= value <= date.today().year + 1:
            raise serializers.ValidationError("Ano inválido.")
        return value

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Preço deve ser positivo.")
        return value

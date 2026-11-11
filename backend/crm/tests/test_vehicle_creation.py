from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crm.models import Store, StoreMembership, Vehicle


pytestmark = pytest.mark.django_db


@pytest.fixture
def context():
    user = get_user_model().objects.create_user(username="vehicle-manager")
    managed = Store.objects.create(name="Gerenciada", slug="managed")
    seller = Store.objects.create(name="Vendedor", slug="seller")
    unrelated = Store.objects.create(name="Outra", slug="unrelated")
    StoreMembership.objects.create(user=user, store=managed, role="manager")
    StoreMembership.objects.create(user=user, store=seller, role="seller")
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(user)
    token = client.get("/api/auth/session/").json()["csrfToken"]
    data = {"store": managed.pk, "brand": "Toyota", "model": "Corolla",
            "year": 2022, "mileage": 0, "price": "119900.50"}
    return client, token, user, managed, seller, unrelated, data


@pytest.mark.parametrize("optional", [False, True])
def test_create_with_real_session_csrf_and_refresh(context, optional):
    client, token, _, managed, _, _, data = context
    if optional:
        data.update(trim="XEi", transmission="Automático", fuel="Flex",
                    status="reserved", stock_type="consignment")
    response = client.post("/api/vehicles/", data, format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 201, response.data
    vehicle = Vehicle.objects.get()
    assert vehicle.store == managed
    assert vehicle.price == Decimal("119900.50")
    assert vehicle.mileage == 0
    assert vehicle.source == "manual" and vehicle.external_id is None
    assert vehicle.status == ("reserved" if optional else "available")
    assert vehicle.stock_type == ("consignment" if optional else "owned")
    assert vehicle.trim == ("XEi" if optional else "")
    assert vehicle.transmission == ("Automático" if optional else "")
    assert vehicle.fuel == ("Flex" if optional else "")
    assert response.json()["price"] == "119900.50"
    assert client.get("/api/vehicles/").json()["results"] == [response.json()]


@pytest.mark.parametrize("field,value", [
    ("brand", ""), ("brand", "x" * 81), ("model", "x" * 101),
    ("trim", "x" * 121), ("transmission", "x" * 31), ("fuel", "x" * 31),
    ("year", 1899), ("year", date.today().year + 2), ("year", 2022.5),
    ("mileage", -1), ("mileage", 0.5), ("price", "0.00"),
    ("price", "1.123"), ("price", "10000000000.00"),
    ("status", "invalid"), ("stock_type", "invalid"),
])
def test_invalid_create_is_atomic_with_field_errors(context, field, value):
    client, token, *_, data = context
    data[field] = value
    response = client.post("/api/vehicles/", data, format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 400
    assert field in response.json()
    assert not Vehicle.objects.exists()


@pytest.mark.parametrize("field", ["store", "brand", "model", "year", "mileage", "price"])
def test_required_create_fields(context, field):
    client, token, *_, data = context
    data.pop(field)
    response = client.post("/api/vehicles/", data, format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 400
    assert field in response.json()
    assert not Vehicle.objects.exists()


@pytest.mark.parametrize("target", ["seller", "unrelated", "revoked", "superuser_without_membership"])
def test_create_permission_is_specific_to_target_store(context, target):
    client, token, user, managed, seller, unrelated, data = context
    if target == "seller":
        data["store"] = seller.pk
    elif target == "unrelated":
        data["store"] = unrelated.pk
    elif target == "revoked":
        StoreMembership.objects.filter(user=user, store=managed).update(role="seller")
    else:
        user.is_staff = user.is_superuser = True
        user.save()
        StoreMembership.objects.filter(user=user).delete()
    response = client.post("/api/vehicles/", data, format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 403
    assert "Somente gerentes" in response.json()["detail"]
    assert not Vehicle.objects.exists()
    assert client.get("/api/auth/session/").json()["user"]["id"] == user.pk


@pytest.mark.parametrize("failure", ["missing_csrf", "invalid_csrf", "untrusted_origin", "expired_session"])
def test_create_rejects_invalid_session_or_csrf(context, failure):
    client, token, *_, data = context
    headers = {"HTTP_X_CSRFTOKEN": token}
    if failure == "missing_csrf":
        headers = {}
    elif failure == "invalid_csrf":
        headers["HTTP_X_CSRFTOKEN"] = "invalid"
    elif failure == "untrusted_origin":
        headers["HTTP_ORIGIN"] = "https://untrusted.example"
    else:
        client.logout()
    assert client.post("/api/vehicles/", data, format="json", **headers).status_code == 403
    assert not Vehicle.objects.exists()

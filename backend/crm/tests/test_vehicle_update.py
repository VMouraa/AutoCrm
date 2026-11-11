from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crm.models import Store, StoreMembership, Vehicle


pytestmark = pytest.mark.django_db


@pytest.fixture
def context():
    user = get_user_model().objects.create_user(username="vehicle-editor")
    managed = Store.objects.create(name="Gerenciada", slug="edit-managed")
    seller = Store.objects.create(name="Vendedor", slug="edit-seller")
    hidden = Store.objects.create(name="Externa", slug="edit-hidden")
    second = Store.objects.create(name="Outra gerenciada", slug="edit-second")
    for store, role in [(managed, "manager"), (seller, "seller"), (second, "manager")]:
        StoreMembership.objects.create(user=user, store=store, role=role)
    values = dict(brand="Toyota", model="Corolla", trim="XEi", year=2022, mileage=45000,
                  transmission="Automático", fuel="Flex", price="119900.50")
    own = Vehicle.objects.create(store=managed, **values)
    seller_vehicle = Vehicle.objects.create(store=seller, **values)
    hidden_vehicle = Vehicle.objects.create(store=hidden, **values)
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(user)
    token = client.get("/api/auth/session/").json()["csrfToken"]
    return client, token, user, own, seller_vehicle, hidden_vehicle, second


def edit_payload():
    return dict(brand="Honda", model="Civic", trim="Touring", year=2023, mileage=100,
                transmission="CVT", fuel="Gasolina", price="120000.75",
                status="reserved", stock_type="consignment")


@pytest.mark.parametrize("method", ["patch", "put"])
def test_manager_updates_editable_fields_with_session_and_csrf(context, method):
    client, token, _, vehicle, *_ = context
    url = f"/api/vehicles/{vehicle.pk}/"
    response = getattr(client, method)(url, edit_payload(), format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 200, response.data
    vehicle.refresh_from_db()
    for field, expected in edit_payload().items():
        assert getattr(vehicle, field) == (Decimal(expected) if field == "price" else expected)
    assert response.json()["price"] == "120000.75"
    assert client.get(url).json() == response.json()
    assert Vehicle.objects.count() == 3


@pytest.mark.parametrize("initial,status", [("available", "reserved"), ("reserved", "sold"), ("sold", "available")])
def test_status_only_patch_keeps_other_fields(context, initial, status):
    client, token, _, vehicle, *_ = context
    Vehicle.objects.filter(pk=vehicle.pk).update(status=initial)
    before = Vehicle.objects.values().get(pk=vehicle.pk)
    response = client.patch(f"/api/vehicles/{vehicle.pk}/", {"status": status}, format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 200
    after = Vehicle.objects.values().get(pk=vehicle.pk)
    assert after["status"] == response.json()["status"] == status
    for field, value in before.items():
        if field not in {"status", "updated_at"}:
            assert after[field] == value


@pytest.mark.parametrize("method", ["patch", "put"])
@pytest.mark.parametrize("target", ["seller", "hidden", "second"])
def test_update_cannot_transfer_store_or_change_read_only_fields(context, method, target):
    client, token, _, vehicle, seller_vehicle, hidden_vehicle, second = context
    store_id = {"seller": seller_vehicle.store_id, "hidden": hidden_vehicle.store_id, "second": second.pk}[target]
    original_store = vehicle.store_id
    original_created = vehicle.created_at
    data = {**edit_payload(), "store": store_id, "source": "changed", "external_id": "changed", "id": 99999,
            "created_at": "2000-01-01T00:00:00Z", "updated_at": "2000-01-01T00:00:00Z"}
    response = getattr(client, method)(f"/api/vehicles/{vehicle.pk}/", data, format="json", HTTP_X_CSRFTOKEN=token)
    # Existing contract: read-only input is ignored, rather than rejecting the update.
    assert response.status_code == 200
    vehicle.refresh_from_db()
    assert vehicle.store_id == response.json()["store"] == original_store
    assert vehicle.source == "manual" and vehicle.external_id is None
    assert vehicle.created_at == original_created
    assert response.json()["id"] == vehicle.pk != 99999
    assert vehicle.updated_at.year != 2000


@pytest.mark.parametrize("field,value", [
    ("brand", ""), ("model", "x" * 101), ("trim", "x" * 121),
    ("transmission", "x" * 31), ("fuel", "x" * 31),
    ("year", 1899), ("year", date.today().year + 2), ("mileage", -1),
    ("price", "0.00"), ("price", "1.123"), ("status", "invalid"), ("stock_type", "invalid"),
])
def test_invalid_patch_returns_field_errors_without_mutation(context, field, value):
    client, token, _, vehicle, *_ = context
    before = list(Vehicle.objects.order_by("pk").values())
    response = client.patch(f"/api/vehicles/{vehicle.pk}/", {field: value}, format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 400
    assert field in response.json()
    assert list(Vehicle.objects.order_by("pk").values()) == before


@pytest.mark.parametrize("method", ["patch", "put"])
@pytest.mark.parametrize("access,expected_status", [("seller", 403), ("hidden", 404), ("revoked", 403), ("removed", 404), ("superuser_without_membership", 404)])
def test_update_permissions_and_cross_store_isolation(context, method, access, expected_status):
    client, token, user, vehicle, seller_vehicle, hidden_vehicle, _ = context
    target = vehicle
    if access == "seller":
        target = seller_vehicle
    elif access == "hidden":
        target = hidden_vehicle
    elif access == "revoked":
        StoreMembership.objects.filter(user=user, store=vehicle.store).update(role="seller")
    elif access == "removed":
        StoreMembership.objects.filter(user=user, store=vehicle.store).delete()
    else:
        user.is_staff = user.is_superuser = True
        user.save()
        StoreMembership.objects.filter(user=user).delete()
    before = list(Vehicle.objects.order_by("pk").values())
    # Sending a managed store must never grant access to a vehicle in another store.
    data = {**edit_payload(), "store": vehicle.store_id}
    response = getattr(client, method)(f"/api/vehicles/{target.pk}/", data, format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == expected_status
    assert set(response.json()) == {"detail"}
    assert list(Vehicle.objects.order_by("pk").values()) == before
    assert client.get("/api/auth/session/").json()["user"]["id"] == user.pk
    visible = client.get("/api/vehicles/").json()["results"]
    assert hidden_vehicle.pk not in [item["id"] for item in visible]
    assert client.get(f"/api/vehicles/{hidden_vehicle.pk}/").status_code == 404


@pytest.mark.parametrize("failure", ["missing_csrf", "invalid_csrf", "untrusted_origin", "expired_session"])
def test_patch_requires_session_and_csrf(context, failure):
    client, token, _, vehicle, *_ = context
    before = Vehicle.objects.values().get(pk=vehicle.pk)
    headers = {"HTTP_X_CSRFTOKEN": token}
    if failure == "missing_csrf":
        headers = {}
    elif failure == "invalid_csrf":
        headers["HTTP_X_CSRFTOKEN"] = "invalid"
    elif failure == "untrusted_origin":
        headers["HTTP_ORIGIN"] = "https://untrusted.example"
    else:
        client.logout()
    response = client.patch(f"/api/vehicles/{vehicle.pk}/", {"status": "sold"}, format="json", **headers)
    assert response.status_code == 403
    assert Vehicle.objects.values().get(pk=vehicle.pk) == before


def test_status_update_changes_filtered_pagination(context):
    client, token, _, vehicle, *_ = context
    for _ in range(20):
        Vehicle.objects.create(store=vehicle.store, brand="Toyota", model="Corolla", year=2022, mileage=0, price="1.00")
    url = f"/api/vehicles/?store={vehicle.store_id}&status=available&brand=Toyota"
    assert client.get(f"{url}&page=2").json()["results"][0]["id"] == vehicle.pk
    response = client.patch(f"/api/vehicles/{vehicle.pk}/", {"status": "sold"}, format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 200
    assert client.get(f"{url}&page=2").status_code == 404
    first = client.get(f"{url}&page=1").json()
    assert first["count"] == 20 and first["next"] is None
    assert all(item["status"] == "available" for item in first["results"])

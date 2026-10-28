import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from crm.models import Store, StoreMembership, Vehicle
from crm.inventory.importers import upsert_external_vehicle

@pytest.fixture
def context(db):
    User = get_user_model()
    manager = User.objects.create_user(username="manager", password="pass")
    seller = User.objects.create_user(username="seller", password="pass")
    outsider = User.objects.create_user(username="outsider", password="pass")
    store = Store.objects.create(name="Loja A", slug="loja-a")
    other = Store.objects.create(name="Loja B", slug="loja-b")
    StoreMembership.objects.create(store=store, user=manager, role="manager")
    StoreMembership.objects.create(store=store, user=seller, role="seller")
    StoreMembership.objects.create(store=other, user=outsider, role="manager")
    return manager, seller, outsider, store, other

def payload(store):
    return {"store": store.id, "brand": "Toyota", "model": "Corolla", "year": 2022, "mileage": 45000, "price": "119900.00"}

@pytest.mark.django_db
def test_manager_creates_and_seller_reads(context):
    manager, seller, _, store, _ = context
    api = APIClient(); api.force_authenticate(manager)
    response = api.post("/api/vehicles/", payload(store), format="json")
    assert response.status_code == 201, response.data
    api.force_authenticate(seller)
    assert api.get("/api/vehicles/").data["count"] == 1
    assert api.patch(f"/api/vehicles/{response.data['id']}/", {"price": "1.00"}, format="json").status_code == 403

@pytest.mark.django_db
def test_tenant_isolation_and_no_cross_store_creation(context):
    manager, _, outsider, store, other = context
    api = APIClient(); api.force_authenticate(manager)
    assert api.post("/api/vehicles/", payload(other), format="json").status_code == 403
    created = api.post("/api/vehicles/", payload(store), format="json")
    api.force_authenticate(outsider)
    assert api.get(f"/api/vehicles/{created.data['id']}/").status_code == 404

@pytest.mark.django_db
def test_invalid_price(context):
    manager, _, _, store, _ = context
    api = APIClient(); api.force_authenticate(manager)
    data = payload(store); data["price"] = "-5.00"
    assert api.post("/api/vehicles/", data, format="json").status_code == 400

@pytest.mark.django_db
def test_external_import_is_idempotent(context):
    manager, _, _, store, _ = context
    data = {"brand": "Toyota", "model": "Hilux", "year": 2020, "mileage": 80000, "price": "175900.00"}
    _, first = upsert_external_vehicle(user=manager, store=store, source="partner", external_id="abc-1", payload=data)
    data["price"] = "174900.00"
    vehicle, second = upsert_external_vehicle(user=manager, store=store, source="partner", external_id="abc-1", payload=data)
    assert first and not second and Vehicle.objects.count() == 1
    assert vehicle.price == Decimal("174900.00")


@pytest.mark.django_db
def test_cross_store_access_and_roles(context):
    manager, seller, outsider, store, other = context
    api = APIClient()
    api.force_authenticate(manager)
    vehicle_id = api.post('/api/vehicles/', payload(store), format='json').data['id']
    url = f'/api/vehicles/{vehicle_id}/'
    api.force_authenticate(outsider)
    assert api.get('/api/vehicles/').data['count'] == 0
    assert api.get(f'/api/vehicles/?store={store.pk}').data['count'] == 0
    assert api.patch(url, {'price': '1.00'}, format='json').status_code == 404
    assert api.delete(url).status_code == 404
    StoreMembership.objects.create(store=store, user=outsider, role='seller')
    assert api.get(url).status_code == 200
    assert api.patch(url, {'price': '1.00'}, format='json').status_code == 403
    api.force_authenticate(seller)
    assert api.post('/api/vehicles/', payload(store), format='json').status_code == 403
    assert api.delete(url).status_code == 403
    api.force_authenticate(manager)
    assert api.patch(url, {'store': other.pk}, format='json').status_code == 200
    assert Vehicle.objects.get(pk=vehicle_id).store_id == store.pk
    assert api.delete(url).status_code == 204


@pytest.mark.django_db
@pytest.mark.parametrize('store_id', ['abc', '-1', '1.5', '9' * 30, True, []])
def test_invalid_store_id_returns_bad_request(context, store_id):
    manager, _, _, store, _ = context
    api = APIClient()
    api.force_authenticate(manager)
    data = payload(store)
    data['store'] = store_id
    assert api.post('/api/vehicles/', data, format='json').status_code == 400
    assert api.get('/api/vehicles/', {'store': str(store_id)}).status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize('invalid', [
    {'price': 'NaN'}, {'price': 'Infinity'}, {'price': '-1'},
    {'year': 'invalid'}, {'year': 1899}, {'mileage': -1},
    {'status': 'invalid'}, {'stock_type': 'invalid'}, {'brand': 'x' * 81},
])
def test_import_rejects_invalid_data_atomically(context, invalid):
    manager, _, _, store, _ = context
    data = payload(store)
    data.pop('store')
    upsert_external_vehicle(user=manager, store=store, source='partner', external_id='abc', payload=data)
    data.update(invalid)
    with pytest.raises(ValueError):
        upsert_external_vehicle(user=manager, store=store, source='partner', external_id='abc', payload=data)
    assert Vehicle.objects.count() == 1
    assert Vehicle.objects.get().price == Decimal('119900.00')


@pytest.mark.django_db
def test_import_permissions_and_store_reference(context):
    manager, seller, outsider, store, other = context
    data = payload(store)
    data.pop('store')
    for user in (seller, outsider):
        with pytest.raises(PermissionError):
            upsert_external_vehicle(user=user, store=store, source='partner', external_id='abc', payload=data)
    for user, target in ((manager, store), (outsider, other)):
        upsert_external_vehicle(user=user, store=target, source='partner', external_id='abc', payload=data)
    assert Vehicle.objects.count() == 2


@pytest.mark.django_db
def test_vehicle_requires_authentication(context):
    _, _, _, store, _ = context
    api = APIClient()
    assert api.get('/api/vehicles/').status_code == 403
    assert api.post('/api/vehicles/', payload(store), format='json').status_code == 403

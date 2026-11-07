import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crm.models import Store, StoreMembership, Vehicle


pytestmark = pytest.mark.django_db


@pytest.fixture
def user():
    return get_user_model().objects.create_user(username="store-user")


@pytest.fixture
def api(user):
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(user)
    return client


def add_store(user, name, role):
    store = Store.objects.create(name=name, slug=f"store-{Store.objects.count() + 1}")
    StoreMembership.objects.create(store=store, user=user, role=role)
    return store


@pytest.mark.parametrize("role", ["manager", "seller"])
def test_members_see_their_stores_even_without_vehicles(api, user, role):
    store = add_store(user, "Loja sem veículos", role)

    response = api.get("/api/stores/")

    assert response.status_code == 200
    assert response.json() == [{"id": store.pk, "name": store.name, "role": role}]
    assert not Vehicle.objects.exists()


def test_multiple_stores_have_the_current_users_roles_and_stable_order(api, user):
    seller_store = add_store(user, "Loja B", "seller")
    manager_store = add_store(user, "Loja A", "manager")
    same_name_store = add_store(user, "Loja A", "seller")
    other_user = get_user_model().objects.create_user(username="other-user")
    hidden_store = add_store(other_user, "Loja externa", "manager")
    # A different member's role in a shared store must not leak into the result.
    StoreMembership.objects.create(store=manager_store, user=other_user, role="seller")

    response = api.get(f"/api/stores/?user={other_user.pk}&store={hidden_store.pk}")

    assert response.status_code == 200
    assert response.json() == [
        {"id": manager_store.pk, "name": manager_store.name, "role": "manager"},
        {"id": same_name_store.pk, "name": same_name_store.name, "role": "seller"},
        {"id": seller_store.pk, "name": seller_store.name, "role": "seller"},
    ]


@pytest.mark.parametrize("superuser", [False, True])
def test_users_without_memberships_receive_empty_list(api, user, superuser):
    user.is_superuser = superuser
    user.is_staff = superuser
    user.save()
    other_user = get_user_model().objects.create_user(username="other-user")
    add_store(other_user, "Outra loja", "manager")

    response = api.get("/api/stores/")

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.parametrize("method", ["get", "head", "options"])
def test_anonymous_requests_are_denied(user, method):
    add_store(user, "Loja protegida", "manager")

    response = getattr(APIClient(enforce_csrf_checks=True), method)("/api/stores/")

    assert response.status_code == 403
    assert set(response.data) == {"detail"}


def test_all_stores_are_returned_without_vehicle_pagination(api, user):
    for index in range(21):
        add_store(user, f"Loja {index:02d}", "seller")

    response = api.get("/api/stores/?page=2")

    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) == 21


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE", "TRACE"])
def test_unsupported_methods_are_not_allowed(api, user, method):
    store = add_store(user, "Loja existente", "manager")
    token = api.get("/api/auth/session/").json()["csrfToken"]

    response = api.generic(
        method, "/api/stores/", data='{"name": "Alterada"}',
        content_type="application/json", HTTP_X_CSRFTOKEN=token,
    )

    assert response.status_code == 405
    assert set(response["Allow"].split(", ")) == {"GET", "HEAD", "OPTIONS"}
    store.refresh_from_db()
    assert store.name == "Loja existente"
    assert Store.objects.count() == 1
    assert StoreMembership.objects.count() == 1


def test_head_and_options_are_supported(api, user):
    add_store(user, "Loja", "manager")

    response = api.head("/api/stores/")
    assert response.status_code == 200
    assert response.content == b""
    assert set(response["Allow"].split(", ")) == {"GET", "HEAD", "OPTIONS"}

    response = api.options("/api/stores/")
    assert response.status_code == 200
    assert set(response["Allow"].split(", ")) == {"GET", "HEAD", "OPTIONS"}


def test_no_store_detail_route_is_exposed(api, user):
    store = add_store(user, "Loja", "manager")

    assert api.get(f"/api/stores/{store.pk}/").status_code == 404


def test_removed_membership_is_reflected_on_next_request(api, user):
    store = add_store(user, "Loja", "manager")
    assert len(api.get("/api/stores/").json()) == 1

    StoreMembership.objects.filter(user=user, store=store).delete()

    assert api.get("/api/stores/").json() == []

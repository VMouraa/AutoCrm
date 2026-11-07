import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crm.models import Store, StoreMembership, Vehicle

pytestmark = pytest.mark.django_db


@pytest.fixture
def user():
    return get_user_model().objects.create_user(username="operador", password="test-password")


@pytest.fixture
def api():
    return APIClient(enforce_csrf_checks=True)


def csrf(api):
    response = api.get("/api/auth/session/")
    assert response.status_code == 200
    return response.json()["csrfToken"]


def sign_in(api):
    return api.post("/api/auth/login/", {"username": "operador", "password": "test-password"},
                    format="json", HTTP_X_CSRFTOKEN=csrf(api))


def test_anonymous_session_sets_csrf_without_exposing_secrets(api):
    response = api.get("/api/auth/session/")
    assert response.json()["user"] is None
    assert response.cookies["csrftoken"]
    assert len(response.json()["csrfToken"]) == 64
    assert "no-store" in response["Cache-Control"]
    assert set(response.json()) == {"user", "csrfToken"}


def test_login_session_rotation_and_logout(api, user):
    old_token = csrf(api)
    response = sign_in(api)
    assert response.status_code == 200
    assert response.json()["user"] == {"id": user.pk, "username": user.username}
    assert "no-store" in response["Cache-Control"]
    assert response.cookies["sessionid"]["httponly"]
    assert response.cookies["sessionid"]["samesite"] == "Lax"
    assert api.get("/api/auth/session/").json()["user"]["id"] == user.pk
    assert api.get("/api/vehicles/").status_code == 200
    old_session_id = api.cookies["sessionid"].value
    # A token obtained before login must fail after Django rotates its secret.
    assert api.post("/api/auth/logout/", HTTP_X_CSRFTOKEN=old_token).status_code == 403
    response = api.post("/api/auth/logout/", HTTP_X_CSRFTOKEN=csrf(api))
    assert response.status_code == 200
    assert response.json()["user"] is None
    assert api.get("/api/auth/session/").json()["user"] is None
    assert api.get("/api/vehicles/").status_code == 403
    # Even replaying the former cookie cannot recover the server-side session.
    api.cookies["sessionid"] = old_session_id
    assert api.get("/api/vehicles/").status_code == 403


@pytest.mark.parametrize("endpoint", ["login", "logout"])
def test_auth_posts_require_csrf_even_when_anonymous(api, user, endpoint):
    csrf(api)
    response = api.post(f"/api/auth/{endpoint}/", {"username": user.username, "password": "test-password"}, format="json")
    assert response.status_code == 403


@pytest.mark.parametrize("endpoint", ["login", "logout"])
def test_auth_posts_reject_untrusted_origins(api, user, endpoint):
    response = api.post(f"/api/auth/{endpoint}/", {"username": user.username, "password": "test-password"},
                        format="json", HTTP_X_CSRFTOKEN=csrf(api), HTTP_ORIGIN="https://untrusted.example")
    assert response.status_code == 403


@pytest.mark.parametrize("origin", ["http://127.0.0.1:5173", "http://localhost:5173"])
def test_login_accepts_configured_vite_origin(api, user, origin, settings):
    settings.CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"]
    response = api.post("/api/auth/login/", {"username": user.username, "password": "test-password"},
                        format="json", HTTP_X_CSRFTOKEN=csrf(api), HTTP_ORIGIN=origin)
    assert response.status_code == 200


@pytest.mark.parametrize("active,password", [(True, "wrong-password"), (False, "test-password")])
def test_invalid_or_inactive_login_has_generic_error(api, user, active, password):
    user.is_active = active
    user.save()
    response = api.post("/api/auth/login/", {"username": user.username, "password": password},
                        format="json", HTTP_X_CSRFTOKEN=csrf(api))
    assert response.status_code == 401
    assert response.json() == {"detail": "Usuário ou senha inválidos."}
    assert api.get("/api/auth/session/").json()["user"] is None


@pytest.mark.parametrize("data", ["{", "[]", '{"username": 1, "password": []}', '{}'])
def test_invalid_login_payload(api, data):
    assert api.post("/api/auth/login/", data, content_type="application/json", HTTP_X_CSRFTOKEN=csrf(api)).status_code == 400


def test_auth_method_and_content_type(api):
    assert api.get("/api/auth/login/").status_code == 405
    assert api.get("/api/auth/logout/").status_code == 405
    assert api.post("/api/auth/session/", HTTP_X_CSRFTOKEN=csrf(api)).status_code == 405
    assert api.post("/api/auth/login/", {"username": "test"}, HTTP_X_CSRFTOKEN=csrf(api)).status_code == 415


def test_real_session_inventory_pagination_filters_and_permissions(api, user):
    store = Store.objects.create(name="Autorizada", slug="autorizada")
    other = Store.objects.create(name="Outra", slug="outra")
    StoreMembership.objects.create(store=store, user=user, role="seller")
    values = dict(brand="Toyota", model="Corolla", year=2022, mileage=45000, price="119900.00")
    for _ in range(21):
        Vehicle.objects.create(store=store, **values)
    hidden = Vehicle.objects.create(store=other, **values)
    assert sign_in(api).status_code == 200
    response = api.get("/api/vehicles/")
    data = response.json()
    assert data["count"] == 21
    assert len(data["results"]) == 20
    assert data["previous"] is None and data["next"].endswith("?page=2")
    assert all(vehicle["store"] == store.pk for vehicle in data["results"])
    assert data["results"][0]["price"] == "119900.00"
    second = api.get("/api/vehicles/?page=2").json()
    assert len(second["results"]) == 1 and second["next"] is None and second["previous"]
    assert api.get(f"/api/vehicles/{hidden.pk}/").status_code == 404
    assert api.get(f"/api/vehicles/?store={other.pk}").json()["count"] == 0
    assert api.get("/api/vehicles/?brand=Ford").json()["count"] == 0
    assert api.get("/api/vehicles/?status=sold").json()["count"] == 0
    vehicle_id = data["results"][0]["id"]
    assert api.patch(f"/api/vehicles/{vehicle_id}/", {"price": "1.00"}, format="json", HTTP_X_CSRFTOKEN=csrf(api)).status_code == 403
    # Permission denial does not end a valid seller session.
    assert api.get("/api/auth/session/").json()["user"]["id"] == user.pk


def test_authenticated_writes_still_require_csrf(api, user):
    sign_in(api)
    assert api.post("/api/customers/", {"name": "Sem CSRF"}, format="json").status_code == 403

from rest_framework.routers import DefaultRouter
from django.urls import path
from .auth_views import login_view, logout_view, session_view
from .views import CustomerViewSet
from .inventory.views import VehicleViewSet
router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("vehicles", VehicleViewSet, basename="vehicle")
urlpatterns = [
    path("auth/session/", session_view, name="auth-session"),
    path("auth/login/", login_view, name="auth-login"),
    path("auth/logout/", logout_view, name="auth-logout"),
] + router.urls

from rest_framework.routers import DefaultRouter
from .views import CustomerViewSet
from .inventory.views import VehicleViewSet
router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("vehicles", VehicleViewSet, basename="vehicle")
urlpatterns = router.urls

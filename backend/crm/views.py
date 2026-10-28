from rest_framework import viewsets
from rest_framework.filters import SearchFilter
from .models import Customer
from .serializers import CustomerSerializer

class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    filter_backends = [SearchFilter]
    search_fields = ['name', 'phone', 'vehicle_interest']

    def get_queryset(self):
        return Customer.objects.filter(owner=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

from django.contrib import admin
from .models import Customer, Store, StoreMembership, Vehicle
admin.site.register([Customer, Store, StoreMembership, Vehicle])

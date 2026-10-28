import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from crm.models import Customer

@pytest.mark.django_db
def test_requires_login():
    response = APIClient().get('/api/customers/')
    assert response.status_code in (401, 403)

@pytest.mark.django_db
def test_create_and_isolate_customers():
    user_model = get_user_model()
    alice = user_model.objects.create_user(username='alice', password='secure-pass-123')
    bob = user_model.objects.create_user(username='bob', password='secure-pass-123')
    client = APIClient()
    client.force_authenticate(user=alice)
    response = client.post('/api/customers/', {'name':'Cliente Exemplo','phone':'67999999999','source':'instagram'})
    assert response.status_code == 201
    assert Customer.objects.get(pk=response.data['id']).owner == alice
    client.force_authenticate(user=bob)
    assert client.get('/api/customers/').data['count'] == 0
    assert client.get(f"/api/customers/{response.data['id']}/").status_code == 404
    url = f"/api/customers/{response.data['id']}/"
    assert client.patch(url, {'name': 'Alterado'}).status_code == 404
    assert client.delete(url).status_code == 404
    client.force_authenticate(user=alice)
    assert client.patch(url, {'owner': bob.pk, 'name': 'Atualizado'}).status_code == 200
    assert Customer.objects.get(pk=response.data['id']).owner == alice

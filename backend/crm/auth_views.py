"""JSON session endpoints for the same-origin React client.

Use Django views so CSRF middleware also protects anonymous login requests.
DRF SessionAuthentication alone only enforces CSRF for authenticated users.
"""
import json

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST


def session_data(request):
    user = request.user
    return {
        "user": {"id": user.pk, "username": user.get_username()} if user.is_authenticated else None,
        "csrfToken": get_token(request),
    }


@never_cache
@require_GET
def session_view(request):
    return JsonResponse(session_data(request))


@never_cache
@require_POST
@csrf_protect
def login_view(request):
    if request.content_type != "application/json":
        return JsonResponse({"detail": "Envie as credenciais em JSON."}, status=415)
    try:
        data = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({"detail": "JSON inválido."}, status=400)
    if not isinstance(data, dict) or not all(
        isinstance(data.get(field), str) and data[field] for field in ("username", "password")
    ):
        return JsonResponse({"detail": "Informe usuário e senha."}, status=400)
    user = authenticate(request, username=data["username"], password=data["password"])
    if user is None:
        return JsonResponse({"detail": "Usuário ou senha inválidos."}, status=401)
    login(request, user)
    # login rotates the CSRF secret; return a token from the new secret.
    return JsonResponse(session_data(request))


@never_cache
@require_POST
@csrf_protect
def logout_view(request):
    logout(request)
    return JsonResponse(session_data(request))

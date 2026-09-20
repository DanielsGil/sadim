from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CustomTokenObtainPairView,
    CustomTokenRefreshView,
    RegistroInicialView,
    UsuarioViewSet,
)

router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet, basename='usuario')

urlpatterns = [
    # Registro público del primer ADMIN (HU-008, IMP-02, Contrato §3).
    path('auth/register/', RegistroInicialView.as_view(), name='auth_register'),
    # Inicio de sesión (HU-008).
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='auth_login'),
    # Renovación del token de acceso (D2).
    path('auth/refresh/', CustomTokenRefreshView.as_view(), name='auth_refresh'),
    # Gestión de usuarios Operador (HU-044).
    path('', include(router.urls)),
]

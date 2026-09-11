from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CustomTokenObtainPairView

urlpatterns = [
    # Endpoint para iniciar sesión (HU-008)
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='auth_login'),
    # Endpoint para refrescar el token de acceso
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth_refresh'),
]
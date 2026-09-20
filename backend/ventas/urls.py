from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MesaViewSet, VentaViewSet

router = DefaultRouter()
router.register(r'mesas', MesaViewSet, basename='mesa')
router.register(r'ventas', VentaViewSet, basename='venta')

urlpatterns = [
    path('', include(router.urls)),
]

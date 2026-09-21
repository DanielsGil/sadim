from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CierreCajaViewSet, MovimientoCajaViewSet

router = DefaultRouter()
router.register(r'movimientos-caja', MovimientoCajaViewSet, basename='movimiento-caja')
router.register(r'cierres-caja', CierreCajaViewSet, basename='cierre-caja')

urlpatterns = [
    path('', include(router.urls)),
]

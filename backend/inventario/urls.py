from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoriaViewSet, MovimientoInventarioViewSet, ProductoViewSet, StockViewSet

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet)
router.register(r'productos', ProductoViewSet)
router.register(r'inventario/movimientos', MovimientoInventarioViewSet, basename='movimiento-inventario')
router.register(r'inventario/stock', StockViewSet, basename='inventario-stock')

urlpatterns = [
    path('', include(router.urls)),
]
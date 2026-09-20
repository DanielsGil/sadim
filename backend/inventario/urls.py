from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoriaViewSet, MovimientoInventarioViewSet, ProductoViewSet

router = DefaultRouter()
router.register(r'categorias', CategoriaViewSet)
router.register(r'productos', ProductoViewSet)
router.register(r'inventario/movimientos', MovimientoInventarioViewSet, basename='movimiento-inventario')

urlpatterns = [
    path('', include(router.urls)),
]
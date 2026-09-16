import uuid

from rest_framework import mixins, serializers, viewsets
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.permissions import SAFE_METHODS

from .models import Categoria, Producto
from .permissions import EsAdmin, EsAdminUOperador
from .serializers import CategoriaSerializer, ProductoSerializer


class PermisosPorRolMixin:
    """IMP-03: lectura para ADMIN y OPERADOR; escritura (POST/PATCH) solo ADMIN."""

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [EsAdminUOperador()]
        return [EsAdmin()]


class SoloGetPostPatchMixin:
    """D3: el catálogo solo acepta GET, POST y PATCH; PUT y DELETE responden 405."""

    def update(self, request, *args, **kwargs):
        if not kwargs.get('partial', False):
            raise MethodNotAllowed(request.method)
        return super().update(request, *args, **kwargs)


class CategoriaViewSet(
    SoloGetPostPatchMixin,
    PermisosPorRolMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer


class ProductoViewSet(
    SoloGetPostPatchMixin,
    PermisosPorRolMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Producto.objects.all()  # necesario para que el router derive el basename
    serializer_class = ProductoSerializer

    def get_queryset(self):
        queryset = Producto.objects.all()

        # D4: ADMIN ve activos e inactivos (para poder reactivarlos);
        # OPERADOR solo ve productos activos.
        usuario = self.request.user
        if getattr(usuario, 'rol', None) != 'ADMIN':
            queryset = queryset.filter(activo=True)

        categoria_id = self.request.query_params.get('categoria')
        if categoria_id:
            try:
                uuid.UUID(categoria_id)
            except (ValueError, AttributeError, TypeError):
                raise serializers.ValidationError(
                    {'categoria': 'Debe ser un identificador UUID válido.'}
                )
            queryset = queryset.filter(categoria_id=categoria_id)

        tipo = self.request.query_params.get('tipo')
        if tipo:
            valores_validos = [valor for valor, _ in Producto.TIPO_CHOICES]
            if tipo not in valores_validos:
                raise serializers.ValidationError(
                    {'tipo': f'Debe ser uno de: {", ".join(valores_validos)}.'}
                )
            queryset = queryset.filter(tipo=tipo)

        return queryset

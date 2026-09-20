import uuid

from rest_framework import mixins, serializers, viewsets
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response

from core.idempotencia import CreacionIdempotenteMixin, ejecutar_con_idempotencia
from core.models import OperacionSincronizacion
from core.permissions import EsAdminUOperador, ModuloActivoPermission, EsAdmin

from .models import Categoria, MovimientoInventario, Producto
from .serializers import CategoriaSerializer, MovimientoInventarioSerializer, ProductoSerializer
from .services import editar_producto, registrar_entrada


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
    CreacionIdempotenteMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    recurso_sync = 'categorias'


class ProductoViewSet(
    SoloGetPostPatchMixin,
    PermisosPorRolMixin,
    CreacionIdempotenteMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Producto.objects.all()  # necesario para que el router derive el basename
    serializer_class = ProductoSerializer
    recurso_sync = 'productos'

    def perform_update(self, serializer):
        # P-07: controla_stock solo puede cambiar cuando stock_actual = 0
        # (409 PRODUCTO_CON_EXISTENCIAS); la regla vive en la capa de
        # servicios, no en el serializer.
        editar_producto(producto=serializer.instance, datos=serializer.validated_data)

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


class MovimientoInventarioViewSet(
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    /api/inventario/movimientos/ — Contrato API v2 §9. Adelanto de HU-025:
    por ahora solo ENTRADA (ambos roles); MERMA y AJUSTE_MANUAL llegan en
    Sprint 4 (HU-026).
    """

    queryset = MovimientoInventario.objects.all()
    serializer_class = MovimientoInventarioSerializer
    permission_classes = [EsAdminUOperador, ModuloActivoPermission]
    modulo = 'inventario'

    def get_queryset(self):
        queryset = MovimientoInventario.objects.all().order_by('-fecha')
        producto_id = self.request.query_params.get('producto')
        if producto_id:
            queryset = queryset.filter(producto_id=producto_id)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        operation_id = datos.pop('operation_id', None) or uuid.uuid4()

        def _ejecutar():
            movimiento = registrar_entrada(
                usuario=request.user,
                operation_id=operation_id,
                producto=datos['producto'],
                cantidad=datos['cantidad'],
                motivo=datos.get('motivo'),
            )
            return movimiento.pk, self.get_serializer(movimiento).data, 201

        def _estado_actual(objeto_id):
            return self.get_serializer(MovimientoInventario.objects.get(pk=objeto_id)).data

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='movimientos_inventario',
            accion=OperacionSincronizacion.Accion.CREATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

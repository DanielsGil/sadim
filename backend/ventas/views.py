import uuid

from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed, NotFound
from rest_framework.permissions import SAFE_METHODS
from rest_framework.response import Response

from core.idempotencia import CreacionIdempotenteMixin, ejecutar_con_idempotencia
from core.models import OperacionSincronizacion
from core.permissions import EsAdmin, EsAdminUOperador, ModuloActivoPermission

from .models import DetalleVenta, Mesa, Venta
from .serializers import (
    AgregarDetalleSerializer,
    CerrarVentaSerializer,
    DetalleVentaSerializer,
    MesaSerializer,
    OperationIdOpcionalSerializer,
    VentaCrearSerializer,
    VentaSerializer,
)
from .services import abrir_sesion_dinamica, agregar_detalle, cancelar_venta, cerrar_venta, crear_venta_rapida, editar_mesa, quitar_detalle


class SoloGetPostPatchMixin:
    """Igual que en inventario: solo GET, POST y PATCH; PUT y DELETE responden 405."""

    def update(self, request, *args, **kwargs):
        if not kwargs.get('partial', False):
            raise MethodNotAllowed(request.method)
        return super().update(request, *args, **kwargs)


class MesaViewSet(
    SoloGetPostPatchMixin,
    CreacionIdempotenteMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """/api/mesas/ — Contrato v2 §7.1, HU-043."""

    queryset = Mesa.objects.all()
    serializer_class = MesaSerializer
    recurso_sync = 'mesas'
    modulo = 'ventas'

    def get_permissions(self):
        base = [EsAdminUOperador()] if self.request.method in SAFE_METHODS else [EsAdmin()]
        return base + [ModuloActivoPermission()]

    def get_queryset(self):
        queryset = Mesa.objects.all().order_by('numero')
        activa = self.request.query_params.get('activa')
        if activa is not None:
            queryset = queryset.filter(activa=activa.lower() == 'true')
        return queryset

    def perform_update(self, serializer):
        editar_mesa(mesa=serializer.instance, datos=serializer.validated_data)


class VentaViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    /api/ventas/ — Contrato v2 §7. Todo el recurso es de ADMIN y OPERADOR; el
    catálogo de acciones (crear, detalles, cerrar, cancelar) sigue exactamente
    la tabla de rutas del contrato, sin agregar un GET de detalle que no está
    ahí.
    """

    queryset = Venta.objects.all()
    serializer_class = VentaSerializer
    permission_classes = [EsAdminUOperador, ModuloActivoPermission]
    modulo = 'ventas'

    def get_queryset(self):
        queryset = Venta.objects.all().prefetch_related('detalles').order_by('-fecha_apertura')
        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)
        mesa_id = self.request.query_params.get('mesa')
        if mesa_id:
            queryset = queryset.filter(mesa_id=mesa_id)
        return queryset

    def _obtener_venta(self, pk):
        try:
            return Venta.objects.get(pk=pk)
        except (Venta.DoesNotExist, ValueError, TypeError):
            raise NotFound('La venta no existe.')

    def create(self, request, *args, **kwargs):
        serializer = VentaCrearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        operation_id = datos.pop('operation_id', None) or uuid.uuid4()

        def _ejecutar():
            if datos['tipo'] == Venta.Tipo.RAPIDA:
                venta = crear_venta_rapida(
                    usuario=request.user,
                    operation_id=operation_id,
                    medio_pago=datos['medio_pago'],
                    detalles=datos['detalles'],
                )
            else:
                venta = abrir_sesion_dinamica(
                    usuario=request.user, operation_id=operation_id, mesa=datos['mesa'],
                )
            return venta.pk, VentaSerializer(venta).data, 201

        def _estado_actual(objeto_id):
            return VentaSerializer(Venta.objects.get(pk=objeto_id)).data

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='ventas',
            accion=OperacionSincronizacion.Accion.CREATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

    @action(detail=True, methods=['post'], url_path='detalles')
    def detalles(self, request, pk=None):
        venta = self._obtener_venta(pk)
        serializer = AgregarDetalleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        operation_id = datos.pop('operation_id', None) or uuid.uuid4()

        def _ejecutar():
            detalle = agregar_detalle(
                venta=venta, producto=datos['producto'], cantidad=datos['cantidad'],
                operation_id=operation_id,
            )
            return detalle.pk, DetalleVentaSerializer(detalle).data, 201

        def _estado_actual(objeto_id):
            return DetalleVentaSerializer(DetalleVenta.objects.get(pk=objeto_id)).data

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='detalles_venta',
            accion=OperacionSincronizacion.Accion.CREATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

    @action(detail=True, methods=['delete'], url_path=r'detalles/(?P<detalle_id>[^/.]+)')
    def eliminar_detalle(self, request, pk=None, detalle_id=None):
        venta = self._obtener_venta(pk)
        try:
            detalle = venta.detalles.get(pk=detalle_id)
        except (DetalleVenta.DoesNotExist, ValueError, TypeError):
            raise NotFound('El detalle no existe en esta venta.')

        serializer = OperationIdOpcionalSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        operation_id = serializer.validated_data.get('operation_id') or uuid.uuid4()

        detalle_id_original = detalle.pk

        def _ejecutar():
            quitar_detalle(venta=venta, detalle=detalle)
            # detalle.delete() deja detalle.pk en None; se necesita el id
            # original para dejarlo registrado en OperacionSincronizacion.
            return detalle_id_original, None, 204

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='detalles_venta',
            accion=OperacionSincronizacion.Accion.DELETE,
            ejecutar=_ejecutar,
            obtener_estado_actual=lambda objeto_id: None,
        )
        return Response(datos_respuesta, status=status_code)

    @action(detail=True, methods=['patch'], url_path='cerrar')
    def cerrar(self, request, pk=None):
        venta = self._obtener_venta(pk)
        serializer = CerrarVentaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        operation_id = datos.pop('operation_id', None) or uuid.uuid4()

        def _ejecutar():
            venta_cerrada = cerrar_venta(venta=venta, usuario=request.user, medio_pago=datos['medio_pago'])
            return venta_cerrada.pk, VentaSerializer(venta_cerrada).data, 200

        def _estado_actual(objeto_id):
            return VentaSerializer(Venta.objects.get(pk=objeto_id)).data

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='ventas',
            accion=OperacionSincronizacion.Accion.UPDATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

    @action(detail=True, methods=['patch'], url_path='cancelar')
    def cancelar(self, request, pk=None):
        venta = self._obtener_venta(pk)
        serializer = OperationIdOpcionalSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        operation_id = serializer.validated_data.get('operation_id') or uuid.uuid4()

        def _ejecutar():
            venta_cancelada = cancelar_venta(venta=venta)
            return venta_cancelada.pk, VentaSerializer(venta_cancelada).data, 200

        def _estado_actual(objeto_id):
            return VentaSerializer(Venta.objects.get(pk=objeto_id)).data

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='ventas',
            accion=OperacionSincronizacion.Accion.UPDATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

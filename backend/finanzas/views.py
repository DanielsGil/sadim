import uuid

from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from core.idempotencia import ejecutar_con_idempotencia
from core.models import OperacionSincronizacion
from core.permissions import EsAdmin, EsAdminUOperador, ModuloActivoPermission

from .models import CierreCaja, MovimientoCaja
from .serializers import (
    AnularMovimientoSerializer,
    CierreCajaSerializer,
    ConfirmarMovimientoSerializer,
    CrearCierreSerializer,
    MovimientoCajaSerializer,
    RegistrarGastoSerializer,
    ResumenQuerySerializer,
    VistaPreviaCierreSerializer,
)
from .services import (
    anular_movimiento,
    calcular_resumen,
    calcular_vista_previa_cierre,
    confirmar_movimiento,
    crear_cierre,
    registrar_gasto,
)


class MovimientoCajaViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    /api/movimientos-caja/ — Contrato v2 §10 (HU-029, HU-050, HU-027). El
    histórico completo (list) y el resumen son de ADMIN; anular también es
    exclusivo de ADMIN (D15). Registrar gasto, ver pendientes y confirmar son
    de ambos roles.
    """

    queryset = MovimientoCaja.objects.all()
    serializer_class = MovimientoCajaSerializer
    modulo = 'finanzas'

    def get_permissions(self):
        if self.action in ('list', 'resumen', 'anular'):
            return [EsAdmin(), ModuloActivoPermission()]
        return [EsAdminUOperador(), ModuloActivoPermission()]

    def get_queryset(self):
        queryset = MovimientoCaja.objects.all().order_by('-fecha')
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        tipo = self.request.query_params.get('tipo')
        if fecha_desde:
            queryset = queryset.filter(fecha__date__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha__date__lte=fecha_hasta)
        if tipo:
            queryset = queryset.filter(tipo=tipo)
        return queryset

    def _obtener_movimiento(self, pk):
        try:
            return MovimientoCaja.objects.get(pk=pk)
        except (MovimientoCaja.DoesNotExist, ValueError, TypeError):
            raise NotFound('El movimiento de caja no existe.')

    def create(self, request, *args, **kwargs):
        serializer = RegistrarGastoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        operation_id = datos.pop('operation_id', None) or uuid.uuid4()
        datos.pop('tipo', None)

        def _ejecutar():
            movimiento = registrar_gasto(usuario=request.user, operation_id=operation_id, **datos)
            return movimiento.pk, MovimientoCajaSerializer(movimiento).data, 201

        def _estado_actual(objeto_id):
            return MovimientoCajaSerializer(MovimientoCaja.objects.get(pk=objeto_id)).data

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='movimientos_caja',
            accion=OperacionSincronizacion.Accion.CREATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

    @action(detail=False, methods=['get'], url_path='pendientes')
    def pendientes(self, request):
        queryset = MovimientoCaja.objects.filter(
            estado_pago=MovimientoCaja.EstadoPago.PENDIENTE_VERIFICACION,
        ).order_by('fecha')
        return Response(MovimientoCajaSerializer(queryset, many=True).data)

    @action(detail=False, methods=['get'], url_path='resumen')
    def resumen(self, request):
        serializer = ResumenQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return Response(calcular_resumen(fecha=serializer.validated_data['fecha']))

    @action(detail=True, methods=['patch'], url_path='confirmar')
    def confirmar(self, request, pk=None):
        movimiento = self._obtener_movimiento(pk)
        serializer = ConfirmarMovimientoSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        operation_id = serializer.validated_data.get('operation_id') or uuid.uuid4()

        def _ejecutar():
            actualizado = confirmar_movimiento(movimiento=movimiento, usuario=request.user)
            return actualizado.pk, MovimientoCajaSerializer(actualizado).data, 200

        def _estado_actual(objeto_id):
            return MovimientoCajaSerializer(MovimientoCaja.objects.get(pk=objeto_id)).data

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='movimientos_caja',
            accion=OperacionSincronizacion.Accion.UPDATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

    @action(detail=True, methods=['patch'], url_path='anular')
    def anular(self, request, pk=None):
        movimiento = self._obtener_movimiento(pk)
        serializer = AnularMovimientoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        operation_id = datos.pop('operation_id', None) or uuid.uuid4()

        def _ejecutar():
            actualizado = anular_movimiento(movimiento=movimiento, usuario=request.user, motivo=datos['motivo'])
            return actualizado.pk, MovimientoCajaSerializer(actualizado).data, 200

        def _estado_actual(objeto_id):
            return MovimientoCajaSerializer(MovimientoCaja.objects.get(pk=objeto_id)).data

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='movimientos_caja',
            accion=OperacionSincronizacion.Accion.UPDATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)


class CierreCajaViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """/api/cierres-caja/ — Contrato v2 §11 (HU-028). Todo el recurso es solo ADMIN."""

    queryset = CierreCaja.objects.all()
    serializer_class = CierreCajaSerializer
    permission_classes = [EsAdmin, ModuloActivoPermission]
    modulo = 'finanzas'

    def get_queryset(self):
        queryset = CierreCaja.objects.all().order_by('-fecha')
        fecha = self.request.query_params.get('fecha')
        if fecha:
            queryset = queryset.filter(fecha=fecha)
        return queryset

    @action(detail=False, methods=['get'], url_path='vista-previa')
    def vista_previa(self, request):
        """
        D28 (extiende el Contrato v2 §11): GET /api/cierres-caja/vista-previa/,
        solo ADMIN y con finanzas_activo (permisos del ViewSet). Muestra lo que
        consolidaría un cierre registrado ahora, sin guardar nada.
        """
        return Response(VistaPreviaCierreSerializer(calcular_vista_previa_cierre()).data)

    def create(self, request, *args, **kwargs):
        serializer = CrearCierreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        operation_id = datos.pop('operation_id', None) or uuid.uuid4()

        def _ejecutar():
            cierre = crear_cierre(usuario=request.user, operation_id=operation_id, **datos)
            return cierre.pk, CierreCajaSerializer(cierre).data, 201

        def _estado_actual(objeto_id):
            return CierreCajaSerializer(CierreCaja.objects.get(pk=objeto_id)).data

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='cierres_caja',
            accion=OperacionSincronizacion.Accion.CREATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

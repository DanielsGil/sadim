import uuid

from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from core.idempotencia import ejecutar_con_idempotencia
from core.models import OperacionSincronizacion
from core.permissions import EsAdmin, EsAdminUOperador, ModuloActivoPermission

from .models import Abono, ConsumoOrden, CostoOperativoOrden, OrdenTrabajo
from .serializers import (
    AbonoSerializer,
    CambiarEstadoSerializer,
    ConsumoOrdenSerializer,
    CostoOperativoOrdenSerializer,
    OrdenTrabajoCrearSerializer,
    OrdenTrabajoDetalleSerializer,
    OrdenTrabajoSerializer,
    RegistrarAbonoSerializer,
    RegistrarConsumoSerializer,
    RegistrarCostoSerializer,
)
from .services import cambiar_estado, crear_orden, registrar_abono, registrar_consumo, registrar_costo


class OrdenTrabajoViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    /api/ordenes-trabajo/ — Contrato v2 §8 (HU-020, HU-021, HU-022, HU-041,
    HU-023). GET de detalle es D13 (no está en el Contrato original, pero el
    wireframe 5 lo necesita); costos/ es exclusivo de ADMIN, el resto es de
    ADMIN y OPERADOR.
    """

    queryset = OrdenTrabajo.objects.all()
    modulo = 'servicios'

    def get_permissions(self):
        if self.action == 'costos':
            return [EsAdmin(), ModuloActivoPermission()]
        return [EsAdminUOperador(), ModuloActivoPermission()]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return OrdenTrabajoDetalleSerializer
        return OrdenTrabajoSerializer

    def get_queryset(self):
        queryset = OrdenTrabajo.objects.all().order_by('-fecha_solicitud')
        if self.action == 'retrieve':
            queryset = queryset.prefetch_related('abonos')
        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)
        return queryset

    def _obtener_orden(self, pk):
        try:
            return OrdenTrabajo.objects.get(pk=pk)
        except (OrdenTrabajo.DoesNotExist, ValueError, TypeError):
            raise NotFound('La orden de trabajo no existe.')

    def create(self, request, *args, **kwargs):
        serializer = OrdenTrabajoCrearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        operation_id = datos.pop('operation_id', None) or uuid.uuid4()

        def _ejecutar():
            orden = crear_orden(usuario=request.user, operation_id=operation_id, **datos)
            return orden.pk, OrdenTrabajoSerializer(orden, context=self.get_serializer_context()).data, 201

        def _estado_actual(objeto_id):
            orden = OrdenTrabajo.objects.get(pk=objeto_id)
            return OrdenTrabajoSerializer(orden, context=self.get_serializer_context()).data

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='ordenes_trabajo',
            accion=OperacionSincronizacion.Accion.CREATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

    @action(detail=True, methods=['patch'], url_path='estado')
    def estado(self, request, pk=None):
        orden = self._obtener_orden(pk)
        serializer = CambiarEstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        operation_id = datos.pop('operation_id', None) or uuid.uuid4()

        def _respuesta_estado(orden_actual):
            return {'id': str(orden_actual.pk), 'estado': orden_actual.estado}

        def _ejecutar():
            orden_actualizada = cambiar_estado(orden=orden, nuevo_estado=datos['estado'], usuario=request.user)
            return orden_actualizada.pk, _respuesta_estado(orden_actualizada), 200

        def _estado_actual(objeto_id):
            return _respuesta_estado(OrdenTrabajo.objects.get(pk=objeto_id))

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='ordenes_trabajo',
            accion=OperacionSincronizacion.Accion.UPDATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

    @action(detail=True, methods=['post'], url_path='abonos')
    def abonos(self, request, pk=None):
        orden = self._obtener_orden(pk)
        serializer = RegistrarAbonoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        operation_id = datos.pop('operation_id', None) or uuid.uuid4()

        def _respuesta_abono(abono):
            respuesta = AbonoSerializer(abono).data
            respuesta['saldo_pendiente'] = str(abono.orden.saldo_pendiente)
            return respuesta

        def _ejecutar():
            abono = registrar_abono(
                orden=orden, usuario=request.user, operation_id=operation_id,
                valor=datos['valor'], medio_pago=datos['medio_pago'],
                observacion=datos.get('observacion'),
            )
            return abono.pk, _respuesta_abono(abono), 201

        def _estado_actual(objeto_id):
            return _respuesta_abono(Abono.objects.select_related('orden').get(pk=objeto_id))

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='abonos',
            accion=OperacionSincronizacion.Accion.CREATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

    @action(detail=True, methods=['get', 'post'], url_path='consumos')
    def consumos(self, request, pk=None):
        orden = self._obtener_orden(pk)

        if request.method == 'GET':
            queryset = orden.consumos.all().order_by('fecha_registro')
            return Response(ConsumoOrdenSerializer(queryset, many=True).data)

        serializer = RegistrarConsumoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        operation_id = datos.pop('operation_id', None) or uuid.uuid4()

        def _ejecutar():
            consumo = registrar_consumo(
                orden=orden, usuario=request.user, operation_id=operation_id,
                producto=datos['producto'], cantidad=datos['cantidad'],
            )
            return consumo.pk, ConsumoOrdenSerializer(consumo).data, 201

        def _estado_actual(objeto_id):
            return ConsumoOrdenSerializer(ConsumoOrden.objects.get(pk=objeto_id)).data

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='consumos_orden',
            accion=OperacionSincronizacion.Accion.CREATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

    @action(detail=True, methods=['get', 'post'], url_path='costos')
    def costos(self, request, pk=None):
        orden = self._obtener_orden(pk)

        if request.method == 'GET':
            costos = orden.costos.all().order_by('id')
            return Response({
                'costos': CostoOperativoOrdenSerializer(costos, many=True).data,
                'utilidad_neta': orden.utilidad_neta,
            })

        serializer = RegistrarCostoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        operation_id = datos.pop('operation_id', None) or uuid.uuid4()

        def _ejecutar():
            costo = registrar_costo(
                orden=orden, usuario=request.user, operation_id=operation_id,
                concepto=datos['concepto'], valor=datos['valor'],
            )
            return costo.pk, CostoOperativoOrdenSerializer(costo).data, 201

        def _estado_actual(objeto_id):
            return CostoOperativoOrdenSerializer(CostoOperativoOrden.objects.get(pk=objeto_id)).data

        datos_respuesta, status_code = ejecutar_con_idempotencia(
            operation_id=operation_id,
            usuario=request.user,
            recurso='costos_operativos_orden',
            accion=OperacionSincronizacion.Accion.CREATE,
            ejecutar=_ejecutar,
            obtener_estado_actual=_estado_actual,
        )
        return Response(datos_respuesta, status=status_code)

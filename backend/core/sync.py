"""
Despachador de /api/sync/ (HU-032, Bloque 5a, Contrato v2 §13) y de
/api/sync/novedades/ (HU-052).

Principio rector de este módulo (no se repite en cada función): NINGÚN
manejador reimplementa una regla de negocio. Cada uno arma los argumentos a
partir del payload de la operación y llama exactamente a la misma función de
la capa de servicios (o al mismo serializer) que usa el endpoint en línea
correspondiente. Así, una venta rápida en línea y una venta rápida
sincronizada ejecutan literalmente el mismo código de ventas.services.
"""

import uuid
from decimal import Decimal
from datetime import timedelta

from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .exceptions import ErrorNegocio
from .idempotencia import ejecutar_operacion_sync
from .models import OperacionSincronizacion
from .permissions import EsAdminUOperador, verificar_modulo_activo, verificar_rol_admin
from .services import resolver_dispositivo_de_sync

MAXIMO_OPERACIONES_POR_LOTE = 200


# ---------------------------------------------------------------------------
# Sobre de la petición (Contrato v2 §13)
# ---------------------------------------------------------------------------

class OperacionEntradaSerializer(serializers.Serializer):
    operation_id = serializers.UUIDField()
    resource = serializers.CharField()
    action = serializers.ChoiceField(choices=['CREATE', 'UPDATE', 'DELETE'])
    # D18: momento en que la operación se registró en el dispositivo; el
    # ejemplo del Contrato no lo muestra, pero el ERD §5.17 lo exige.
    fecha_cliente = serializers.DateTimeField()
    payload = serializers.DictField()


class LoteSincronizacionSerializer(serializers.Serializer):
    operations = OperacionEntradaSerializer(many=True)

    def validate_operations(self, value):
        if len(value) > MAXIMO_OPERACIONES_POR_LOTE:
            raise serializers.ValidationError(
                f'Un lote admite como máximo {MAXIMO_OPERACIONES_POR_LOTE} operaciones.'
            )
        return value


# ---------------------------------------------------------------------------
# Resolución de dependencias entre operaciones del mismo lote o de lotes
# anteriores (D20)
# ---------------------------------------------------------------------------

def _resolver_o_conflicto_previo(modelo, id_):
    """
    Busca `modelo` por `id_`. Si no existe, revisa si hubo una operación de
    sincronización (de este lote o de uno anterior — cada operación se
    registra en su propia transacción antes de seguir con la siguiente, así
    que para cuando se procesa esta, la anterior ya quedó registrada) que
    debía crear ese id y no se aplicó: en ese caso es D20
    (OPERACION_PREVIA_FALLIDA), no un simple "no existe".
    """
    if not id_:
        raise ErrorNegocio(code='DATOS_INVALIDOS', message='Falta una referencia obligatoria.', status_code=400)
    try:
        return modelo.objects.get(pk=id_)
    except (modelo.DoesNotExist, ValueError, TypeError):
        fallo = (
            OperacionSincronizacion.objects
            .filter(
                objeto_id=id_,
                estado__in=[OperacionSincronizacion.Estado.RECHAZADA, OperacionSincronizacion.Estado.CONFLICTO],
            )
            .order_by('-fecha_procesamiento')
            .first()
        )
        if fallo:
            raise ErrorNegocio(
                code='OPERACION_PREVIA_FALLIDA',
                message=(
                    f'La operación {fallo.operation_id} que debía crear este recurso '
                    f'no se aplicó ({fallo.codigo_conflicto}: {fallo.mensaje}).'
                ),
                status_code=409,
            )
        raise ErrorNegocio(code='DATOS_INVALIDOS', message='El recurso referenciado no existe.', status_code=400)


# ---------------------------------------------------------------------------
# Manejadores por recurso — D17 (lista cerrada). Cada uno llama a la misma
# capa de servicios/serializers que su endpoint en línea equivalente.
# ---------------------------------------------------------------------------

def _sync_crear_categoria(*, usuario, operation_id, payload, fecha_cliente):
    from inventario.serializers import CategoriaSerializer
    verificar_rol_admin(usuario)
    datos = {k: v for k, v in payload.items() if k not in ('id', 'operation_id')}
    serializer = CategoriaSerializer(data=datos)
    serializer.is_valid(raise_exception=True)
    categoria = serializer.save(id=payload.get('id') or uuid.uuid4(), operation_id=operation_id)
    return categoria.pk, None, 201


def _sync_editar_categoria(*, usuario, operation_id, payload, fecha_cliente):
    from inventario.models import Categoria
    from inventario.serializers import CategoriaSerializer
    verificar_rol_admin(usuario)
    categoria = _resolver_o_conflicto_previo(Categoria, payload.get('id'))
    datos = {k: v for k, v in payload.items() if k not in ('id', 'operation_id')}
    serializer = CategoriaSerializer(categoria, data=datos, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return categoria.pk, None, 200


def _sync_crear_producto(*, usuario, operation_id, payload, fecha_cliente):
    from inventario.models import Categoria
    from inventario.serializers import ProductoSerializer
    verificar_rol_admin(usuario)
    categoria = _resolver_o_conflicto_previo(Categoria, payload.get('categoria_id'))
    datos = {k: v for k, v in payload.items() if k not in ('id', 'operation_id')}
    datos['categoria_id'] = str(categoria.pk)
    serializer = ProductoSerializer(data=datos)
    serializer.is_valid(raise_exception=True)
    producto = serializer.save(id=payload.get('id') or uuid.uuid4(), operation_id=operation_id)
    return producto.pk, None, 201


def _sync_editar_producto(*, usuario, operation_id, payload, fecha_cliente):
    from inventario.models import Producto
    from inventario.serializers import ProductoSerializer
    from inventario.services import editar_producto
    verificar_rol_admin(usuario)
    producto = _resolver_o_conflicto_previo(Producto, payload.get('id'))
    datos = {k: v for k, v in payload.items() if k not in ('id', 'operation_id')}
    serializer = ProductoSerializer(producto, data=datos, partial=True)
    serializer.is_valid(raise_exception=True)
    editar_producto(producto=producto, datos=serializer.validated_data)
    return producto.pk, None, 200


def _sync_crear_mesa(*, usuario, operation_id, payload, fecha_cliente):
    from ventas.serializers import MesaSerializer
    verificar_modulo_activo('ventas')
    verificar_rol_admin(usuario)
    datos = {k: v for k, v in payload.items() if k not in ('id', 'operation_id')}
    serializer = MesaSerializer(data=datos)
    serializer.is_valid(raise_exception=True)
    mesa = serializer.save(id=payload.get('id') or uuid.uuid4(), operation_id=operation_id)
    return mesa.pk, None, 201


def _sync_editar_mesa(*, usuario, operation_id, payload, fecha_cliente):
    from ventas.models import Mesa
    from ventas.services import editar_mesa
    verificar_modulo_activo('ventas')
    verificar_rol_admin(usuario)
    mesa = _resolver_o_conflicto_previo(Mesa, payload.get('id'))
    datos = {k: v for k, v in payload.items() if k != 'id'}
    mesa = editar_mesa(mesa=mesa, datos=datos)
    return mesa.pk, None, 200


def _sync_crear_venta(*, usuario, operation_id, payload, fecha_cliente):
    from inventario.models import Producto
    from ventas.models import Mesa, Venta
    from ventas.services import abrir_sesion_dinamica, crear_venta_rapida
    verificar_modulo_activo('ventas')

    tipo = payload.get('tipo')
    if tipo == Venta.Tipo.RAPIDA:
        detalles_payload = payload.get('detalles') or []
        if not detalles_payload:
            raise ErrorNegocio(code='DATOS_INVALIDOS', message='Debe incluir al menos un producto.', status_code=400)
        detalles = []
        for item in detalles_payload:
            producto = _resolver_o_conflicto_previo(Producto, item.get('producto_id'))
            detalles.append({
                'id': item.get('id'),
                'operation_id': item.get('operation_id'),
                'producto': producto,
                'cantidad': Decimal(str(item['cantidad'])),
                'precio_unitario': (
                    Decimal(str(item['precio_unitario'])) if item.get('precio_unitario') is not None else None
                ),
            })
        venta = crear_venta_rapida(
            usuario=usuario, operation_id=operation_id, medio_pago=payload['medio_pago'],
            detalles=detalles, id=payload.get('id'), fecha=fecha_cliente,
        )
        return venta.pk, None, 201

    if tipo == Venta.Tipo.SESION_DINAMICA:
        mesa = _resolver_o_conflicto_previo(Mesa, payload.get('mesa_id'))
        venta = abrir_sesion_dinamica(
            usuario=usuario, operation_id=operation_id, mesa=mesa,
            id=payload.get('id'), fecha=fecha_cliente,
        )
        return venta.pk, None, 201

    raise ErrorNegocio(code='DATOS_INVALIDOS', message='tipo debe ser RAPIDA o SESION_DINAMICA.', status_code=400)


def _sync_agregar_detalle(*, usuario, operation_id, payload, fecha_cliente):
    from inventario.models import Producto
    from ventas.models import Venta
    from ventas.services import agregar_detalle
    verificar_modulo_activo('ventas')
    venta = _resolver_o_conflicto_previo(Venta, payload.get('venta_id'))
    producto = _resolver_o_conflicto_previo(Producto, payload.get('producto_id'))
    detalle = agregar_detalle(
        venta=venta, producto=producto, cantidad=Decimal(str(payload['cantidad'])),
        operation_id=operation_id, id=payload.get('id'),
        precio_unitario=Decimal(str(payload['precio_unitario'])) if payload.get('precio_unitario') is not None else None,
        validar_stock=False,  # D24: por sync el conflicto de stock se resuelve al cerrar (R-19, D12)
    )
    return detalle.pk, None, 201


def _sync_quitar_detalle(*, usuario, operation_id, payload, fecha_cliente):
    from ventas.models import DetalleVenta, Venta
    from ventas.services import quitar_detalle
    verificar_modulo_activo('ventas')
    venta = _resolver_o_conflicto_previo(Venta, payload.get('venta_id'))
    detalle_id = payload.get('id')
    try:
        detalle = venta.detalles.get(pk=detalle_id)
    except (DetalleVenta.DoesNotExist, ValueError, TypeError):
        raise ErrorNegocio(code='DATOS_INVALIDOS', message='El detalle no existe en esta venta.', status_code=400)
    quitar_detalle(venta=venta, detalle=detalle)
    return detalle_id, None, 204


def _sync_cerrar_venta(*, usuario, operation_id, payload, fecha_cliente):
    from ventas.models import Venta
    from ventas.services import cerrar_venta
    verificar_modulo_activo('ventas')
    venta = _resolver_o_conflicto_previo(Venta, payload.get('venta_id'))
    venta_cerrada = cerrar_venta(venta=venta, usuario=usuario, medio_pago=payload['medio_pago'], fecha=fecha_cliente)
    return venta_cerrada.pk, None, 200


def _sync_cancelar_venta(*, usuario, operation_id, payload, fecha_cliente):
    from ventas.models import Venta
    from ventas.services import cancelar_venta
    verificar_modulo_activo('ventas')
    venta = _resolver_o_conflicto_previo(Venta, payload.get('venta_id'))
    venta_cancelada = cancelar_venta(venta=venta)
    return venta_cancelada.pk, None, 200


def _sync_crear_orden(*, usuario, operation_id, payload, fecha_cliente):
    from servicios.services import crear_orden
    verificar_modulo_activo('servicios')
    orden = crear_orden(
        usuario=usuario, operation_id=operation_id,
        cliente_nombre=payload['cliente_nombre'],
        cliente_telefono=payload.get('cliente_telefono'),
        descripcion=payload['descripcion'],
        fecha_entrega_estimada=payload['fecha_entrega_estimada'],
        costo_total=Decimal(str(payload['costo_total'])),
        id=payload.get('id'), fecha=fecha_cliente,
    )
    return orden.pk, None, 201


def _sync_cambiar_estado_orden(*, usuario, operation_id, payload, fecha_cliente):
    from servicios.models import OrdenTrabajo
    from servicios.services import cambiar_estado
    verificar_modulo_activo('servicios')
    orden = _resolver_o_conflicto_previo(OrdenTrabajo, payload.get('orden_id'))
    orden_actualizada = cambiar_estado(
        orden=orden, nuevo_estado=payload['estado'], usuario=usuario, fecha=fecha_cliente,
    )
    return orden_actualizada.pk, None, 200


def _sync_registrar_abono(*, usuario, operation_id, payload, fecha_cliente):
    from servicios.models import OrdenTrabajo
    from servicios.services import registrar_abono
    verificar_modulo_activo('servicios')
    orden = _resolver_o_conflicto_previo(OrdenTrabajo, payload.get('orden_id'))
    abono = registrar_abono(
        orden=orden, usuario=usuario, operation_id=operation_id,
        valor=Decimal(str(payload['valor'])), medio_pago=payload['medio_pago'],
        observacion=payload.get('observacion'), id=payload.get('id'), fecha=fecha_cliente,
    )
    return abono.pk, None, 201


def _sync_registrar_consumo(*, usuario, operation_id, payload, fecha_cliente):
    from inventario.models import Producto
    from servicios.models import OrdenTrabajo
    from servicios.services import registrar_consumo
    verificar_modulo_activo('servicios')
    orden = _resolver_o_conflicto_previo(OrdenTrabajo, payload.get('orden_id'))
    producto = _resolver_o_conflicto_previo(Producto, payload.get('producto_id'))
    consumo = registrar_consumo(
        orden=orden, usuario=usuario, operation_id=operation_id, producto=producto,
        cantidad=Decimal(str(payload['cantidad'])), id=payload.get('id'), fecha=fecha_cliente,
    )
    return consumo.pk, None, 201


def _sync_registrar_costo(*, usuario, operation_id, payload, fecha_cliente):
    from servicios.models import OrdenTrabajo
    from servicios.services import registrar_costo
    verificar_modulo_activo('servicios')
    verificar_rol_admin(usuario)
    orden = _resolver_o_conflicto_previo(OrdenTrabajo, payload.get('orden_id'))
    costo = registrar_costo(
        orden=orden, usuario=usuario, operation_id=operation_id,
        concepto=payload['concepto'], valor=Decimal(str(payload['valor'])), id=payload.get('id'),
    )
    return costo.pk, None, 201


def _sync_registrar_movimiento_inventario(*, usuario, operation_id, payload, fecha_cliente):
    from inventario.models import Producto
    from inventario.services import registrar_movimiento
    verificar_modulo_activo('inventario')
    producto = _resolver_o_conflicto_previo(Producto, payload.get('producto_id'))
    movimiento = registrar_movimiento(
        usuario=usuario, operation_id=operation_id, tipo=payload['tipo'], producto=producto,
        cantidad=Decimal(str(payload['cantidad'])), motivo=payload.get('motivo'),
        sentido=payload.get('sentido'), id=payload.get('id'), fecha=fecha_cliente,
    )
    return movimiento.pk, None, 201


def _sync_registrar_gasto(*, usuario, operation_id, payload, fecha_cliente):
    from finanzas.models import MovimientoCaja
    from finanzas.services import registrar_gasto
    verificar_modulo_activo('finanzas')
    tipo = payload.get('tipo', MovimientoCaja.Tipo.GASTO)
    if tipo != MovimientoCaja.Tipo.GASTO:
        # D17: movimientos-caja CREATE solo admite GASTO por sincronización;
        # INGRESO_VENTA/INGRESO_ABONO los genera el sistema, nunca el cliente.
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message='Por sincronización solo se pueden registrar gastos.',
            status_code=400,
        )
    movimiento = registrar_gasto(
        usuario=usuario, operation_id=operation_id, medio_pago=payload['medio_pago'],
        valor=Decimal(str(payload['valor'])), concepto=payload['concepto'],
        id=payload.get('id'), fecha=fecha_cliente,
    )
    return movimiento.pk, None, 201


def _sync_editar_configuracion_modulos(*, usuario, operation_id, payload, fecha_cliente):
    from .services import actualizar_configuracion_modulos
    verificar_rol_admin(usuario)
    datos = {k: v for k, v in payload.items() if k != 'id'}
    instancia = actualizar_configuracion_modulos(usuario=usuario, datos=datos)
    return instancia.pk, None, 200


def _manejador_no_disponible(mensaje, code, status_code=400):
    def _handler(*, usuario, operation_id, payload, fecha_cliente):
        raise ErrorNegocio(code=code, message=mensaje, status_code=status_code)
    return _handler


# D17: lista cerrada de combinaciones (resource, action) sincronizables.
RECURSOS_SINCRONIZABLES = {
    ('categorias', 'CREATE'): _sync_crear_categoria,
    ('categorias', 'UPDATE'): _sync_editar_categoria,
    ('productos', 'CREATE'): _sync_crear_producto,
    ('productos', 'UPDATE'): _sync_editar_producto,
    ('mesas', 'CREATE'): _sync_crear_mesa,
    ('mesas', 'UPDATE'): _sync_editar_mesa,
    ('ventas', 'CREATE'): _sync_crear_venta,
    ('ventas.detalles', 'CREATE'): _sync_agregar_detalle,
    ('ventas.detalles', 'DELETE'): _sync_quitar_detalle,
    ('ventas.cerrar', 'UPDATE'): _sync_cerrar_venta,
    ('ventas.cancelar', 'UPDATE'): _sync_cancelar_venta,
    ('ordenes-trabajo', 'CREATE'): _sync_crear_orden,
    ('ordenes-trabajo.estado', 'UPDATE'): _sync_cambiar_estado_orden,
    ('ordenes-trabajo.abonos', 'CREATE'): _sync_registrar_abono,
    ('ordenes-trabajo.consumos', 'CREATE'): _sync_registrar_consumo,
    ('ordenes-trabajo.costos', 'CREATE'): _sync_registrar_costo,
    ('inventario.movimientos', 'CREATE'): _sync_registrar_movimiento_inventario,
    ('movimientos-caja', 'CREATE'): _sync_registrar_gasto,
    ('configuracion.modulos', 'UPDATE'): _sync_editar_configuracion_modulos,
    # E-01: un pago electrónico solo se confirma en línea, nunca por sync.
    ('movimientos-caja.confirmar', 'UPDATE'): _manejador_no_disponible(
        'La confirmación de un pago electrónico requiere conexión.',
        code='PAGO_NO_VERIFICABLE',
    ),
}

# Campo del payload que identifica la fila afectada por cada recurso, para
# poder registrar objeto_id incluso cuando la operación se rechaza o entra en
# conflicto (D20: así una operación posterior puede detectar la dependencia
# fallida). None para configuracion.modulos: es una fila única (singleton).
CAMPO_OBJETO_ID = {
    'categorias': 'id',
    'productos': 'id',
    'mesas': 'id',
    'ventas': 'id',
    'ventas.detalles': 'id',
    'ventas.cerrar': 'venta_id',
    'ventas.cancelar': 'venta_id',
    'ordenes-trabajo': 'id',
    'ordenes-trabajo.estado': 'orden_id',
    'ordenes-trabajo.abonos': 'id',
    'ordenes-trabajo.consumos': 'id',
    'ordenes-trabajo.costos': 'id',
    'inventario.movimientos': 'id',
    'movimientos-caja': 'id',
    'configuracion.modulos': None,
    'movimientos-caja.confirmar': None,
}


def _procesar_operacion(*, usuario, dispositivo, operacion):
    operation_id = operacion['operation_id']
    resource = operacion['resource']
    action = operacion['action']
    fecha_cliente = operacion['fecha_cliente']
    payload = operacion['payload'] or {}

    campo_objeto_id = CAMPO_OBJETO_ID.get(resource)
    objeto_id_si_falla = payload.get(campo_objeto_id) if campo_objeto_id else None

    manejador = RECURSOS_SINCRONIZABLES.get((resource, action))
    if manejador is None:
        manejador = _manejador_no_disponible(
            f'La operación {resource}.{action} requiere conexión.', code='DATOS_INVALIDOS',
        )

    def _ejecutar():
        # D18: una fecha_cliente más de 5 minutos en el futuro se rechaza
        # antes de tocar cualquier regla de negocio del recurso.
        if fecha_cliente > timezone.now() + timedelta(minutes=5):
            raise ErrorNegocio(
                code='DATOS_INVALIDOS',
                message='fecha_cliente no puede ser una fecha futura.',
                status_code=400,
            )
        # Cada manejador devuelve (objeto_id, datos_respuesta, status_code),
        # la misma forma que ejecutar_con_idempotencia espera en línea.
        return manejador(usuario=usuario, operation_id=operation_id, payload=payload, fecha_cliente=fecha_cliente)

    return ejecutar_operacion_sync(
        operation_id=operation_id,
        usuario=usuario,
        dispositivo=dispositivo,
        recurso=resource,
        accion=action,
        fecha_cliente=fecha_cliente,
        payload=payload,
        ejecutar=_ejecutar,
        objeto_id_si_falla=objeto_id_si_falla,
    )


class SincronizacionView(APIView):
    """POST /api/sync/ — HU-032, Contrato v2 §13. Autenticado, ambos roles."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        # D16: el dispositivo se valida ANTES de tocar cualquier operación;
        # si no está autorizado, se rechaza el lote completo sin registrar
        # ningún operation_id (para que un reenvío tras autorizar no salga
        # DUPLICADA). Desviación intencional del texto de D-04.
        dispositivo = resolver_dispositivo_de_sync(device_id_header=request.headers.get('X-Device-Id'))

        serializer = LoteSincronizacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        resultados = [
            _procesar_operacion(usuario=request.user, dispositivo=dispositivo, operacion=operacion)
            for operacion in serializer.validated_data['operations']
        ]

        dispositivo.ultima_sincronizacion = timezone.now()
        dispositivo.save(update_fields=['ultima_sincronizacion'])

        return Response({'results': resultados})


class NovedadSerializer(serializers.ModelSerializer):
    dispositivo_id = serializers.PrimaryKeyRelatedField(source='dispositivo', read_only=True)
    usuario_id = serializers.PrimaryKeyRelatedField(source='usuario', read_only=True)

    class Meta:
        model = OperacionSincronizacion
        fields = [
            'id', 'operation_id', 'dispositivo_id', 'usuario_id', 'recurso', 'accion',
            'estado', 'codigo_conflicto', 'mensaje', 'objeto_id', 'fecha_cliente',
            'fecha_procesamiento', 'atendida',
        ]
        read_only_fields = fields


class MarcarAtendidaSerializer(serializers.Serializer):
    atendida = serializers.BooleanField()


class NovedadSincronizacionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    /api/sync/novedades/ — HU-052. GET (?atendida=) y PATCH, ambos roles
    (Contrato v2 §13): solo operaciones origen=SINCRONIZACION en RECHAZADA o
    CONFLICTO (R-33) — un rechazo en línea ya se informó en la respuesta HTTP.
    """

    queryset = OperacionSincronizacion.objects.all()
    serializer_class = NovedadSerializer
    permission_classes = [EsAdminUOperador]

    def get_queryset(self):
        queryset = OperacionSincronizacion.objects.filter(
            origen=OperacionSincronizacion.Origen.SINCRONIZACION,
            estado__in=[OperacionSincronizacion.Estado.RECHAZADA, OperacionSincronizacion.Estado.CONFLICTO],
        ).order_by('-fecha_procesamiento')
        atendida = self.request.query_params.get('atendida')
        if atendida is not None:
            queryset = queryset.filter(atendida=atendida.lower() == 'true')
        return queryset

    def partial_update(self, request, pk=None):
        novedad = self.get_object()
        serializer = MarcarAtendidaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        novedad.atendida = serializer.validated_data['atendida']
        novedad.save(update_fields=['atendida'])
        return Response(NovedadSerializer(novedad).data)

"""Capa de servicios de Órdenes de trabajo: reglas de negocio, no de forma (ADR-002)."""

import uuid
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone

from core.exceptions import ErrorNegocio
from core.models import ConfiguracionPago
from core.permissions import verificar_rol_admin
from finanzas.models import MovimientoCaja
from inventario.models import Producto
from inventario.services import crear_salida_servicio

from .models import Abono, ConsumoOrden, CostoOperativoOrden, OrdenTrabajo

ORDEN_TRANSICIONES = [
    OrdenTrabajo.Estado.RECIBIDO,
    OrdenTrabajo.Estado.EN_PROCESO,
    OrdenTrabajo.Estado.LISTO,
    OrdenTrabajo.Estado.ENTREGADO,
]


def _validar_medio_pago_habilitado(medio_pago):
    configuracion = ConfiguracionPago.objects.obtener()
    habilitado = {
        Abono.MedioPago.EFECTIVO: configuracion.acepta_efectivo,
        Abono.MedioPago.TRANSFERENCIA: configuracion.acepta_transferencia,
        Abono.MedioPago.QR: configuracion.acepta_qr,
    }[medio_pago]
    if not habilitado:
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message=f'El medio de pago {medio_pago} no está habilitado en esta instalación.',
            status_code=400,
        )


def _verificar_no_cancelada(orden):
    """D29: sobre una orden CANCELADA ninguna operación procede (409 ORDEN_CANCELADA)."""
    if orden.estado == OrdenTrabajo.Estado.CANCELADA:
        raise ErrorNegocio(
            code='ORDEN_CANCELADA',
            message='La orden fue cancelada; no admite más operaciones.',
            status_code=409,
        )


def _estado_pago_para(medio_pago):
    return (
        Abono.EstadoPago.CONFIRMADO if medio_pago == Abono.MedioPago.EFECTIVO
        else Abono.EstadoPago.PENDIENTE_VERIFICACION
    )


# ---------------------------------------------------------------------------
# HU-020 — registrar orden
# ---------------------------------------------------------------------------

def crear_orden(*, usuario, operation_id, cliente_nombre, cliente_telefono, descripcion,
                 fecha_entrega_estimada, costo_total, id=None, fecha=None):
    """
    Contrato v2 §8 (CU-06): estado inicial RECIBIDO; sin abonos, saldo_pendiente = costo_total.
    `id`/`fecha`: /api/sync/ (D17/D18) pasa el id del dispositivo y usa
    fecha_cliente como fecha_solicitud; en línea se omiten.
    """
    return OrdenTrabajo.objects.create(
        id=id or uuid.uuid4(),
        operation_id=operation_id,
        usuario=usuario,
        cliente_nombre=cliente_nombre,
        cliente_telefono=cliente_telefono,
        descripcion=descripcion,
        fecha_solicitud=fecha or timezone.now(),
        fecha_entrega_estimada=fecha_entrega_estimada,
        estado=OrdenTrabajo.Estado.RECIBIDO,
        costo_total=costo_total,
        saldo_pendiente=costo_total,
        utilidad_neta=costo_total,
    )


# ---------------------------------------------------------------------------
# HU-021 — cambiar estado (avance de a uno, entrega atómica)
# ---------------------------------------------------------------------------

def _bloquear_productos_de_consumos(consumos):
    """Bloquea (select_for_update), en orden estable, los productos con
    controla_stock=true de los consumos a aplicar."""
    producto_ids = sorted({
        str(c.producto_id) for c in consumos if c.producto.controla_stock
    })
    productos = Producto.objects.select_for_update().filter(id__in=producto_ids)
    return {str(p.id): p for p in productos}


def _validar_existencias_de_consumos(consumos, productos):
    """Equivalente de D12/R-19 para la entrega de una orden: valida TODA la
    operación antes de aplicar ningún efecto."""
    necesidad: dict[str, Decimal] = {}
    for consumo in consumos:
        if consumo.producto.controla_stock:
            clave = str(consumo.producto_id)
            necesidad[clave] = necesidad.get(clave, Decimal('0')) + consumo.cantidad

    faltantes = []
    for producto_id, cantidad_necesaria in necesidad.items():
        producto = productos[producto_id]
        if producto.stock_actual < cantidad_necesaria:
            faltantes.append({
                'producto_id': producto_id,
                'nombre': producto.nombre,
                'disponible': str(producto.stock_actual),
                'requerido': str(cantidad_necesaria),
            })
    if faltantes:
        raise ErrorNegocio(
            code='STOCK_INSUFICIENTE',
            message='Las existencias no alcanzan para entregar la orden.',
            status_code=409,
            details={'productos': faltantes},
        )


def _entregar(*, orden, usuario, fecha=None):
    """R-15, R-18, R-16 (P-05): paso a ENTREGADO, atómico. `fecha` (D18): la
    SALIDA_SERVICIO usa fecha_cliente como fecha de negocio en sincronización."""
    consumos = list(
        orden.consumos.filter(estado=ConsumoOrden.Estado.PENDIENTE).select_related('producto')
    )
    productos = _bloquear_productos_de_consumos(consumos)
    _validar_existencias_de_consumos(consumos, productos)

    for consumo in consumos:
        if consumo.producto.controla_stock:
            producto = productos[str(consumo.producto_id)]
            movimiento = crear_salida_servicio(
                producto=producto, usuario=usuario, consumo_orden=consumo, cantidad=consumo.cantidad,
                fecha=fecha,
            )
            consumo.estado = ConsumoOrden.Estado.APLICADO
            consumo.save(update_fields=['estado'])
        else:
            consumo.estado = ConsumoOrden.Estado.APLICADO
            consumo.save(update_fields=['estado'])

    orden.estado = OrdenTrabajo.Estado.ENTREGADO
    orden.save(update_fields=['estado'])
    return orden


def cambiar_estado(*, orden, nuevo_estado, usuario, fecha=None):
    """
    Contrato v2 §8 (CU-07, R-16): solo avanza al estado siguiente (saltar o
    retroceder → 400 DATOS_INVALIDOS); sobre ENTREGADO → 409
    ORDEN_YA_ENTREGADA. El paso a ENTREGADO es atómico (R-15).
    """
    orden = OrdenTrabajo.objects.select_for_update().get(pk=orden.pk)
    _verificar_no_cancelada(orden)

    if orden.estado == OrdenTrabajo.Estado.ENTREGADO:
        raise ErrorNegocio(
            code='ORDEN_YA_ENTREGADA',
            message='La orden ya fue entregada.',
            status_code=409,
        )

    indice_actual = ORDEN_TRANSICIONES.index(orden.estado)
    try:
        indice_nuevo = ORDEN_TRANSICIONES.index(nuevo_estado)
    except ValueError:
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message=f'Estado inválido: {nuevo_estado}.',
            status_code=400,
        )

    if indice_nuevo != indice_actual + 1:
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message='La orden solo puede avanzar al estado siguiente.',
            status_code=400,
        )

    if nuevo_estado == OrdenTrabajo.Estado.ENTREGADO:
        return _entregar(orden=orden, usuario=usuario, fecha=fecha)

    orden.estado = nuevo_estado
    orden.save(update_fields=['estado'])
    return orden


# ---------------------------------------------------------------------------
# HU-022 — abonos
# ---------------------------------------------------------------------------

def registrar_abono(*, orden, usuario, operation_id, valor, medio_pago, observacion=None, id=None, fecha=None):
    """
    Contrato v2 §8 (CU-08, R-12..R-14). No está restringido a un estado de la
    orden: el Contrato no lo condiciona (a diferencia de consumos y costos),
    porque un cliente puede seguir abonando incluso tras la entrega.
    """
    orden = OrdenTrabajo.objects.select_for_update().get(pk=orden.pk)
    _verificar_no_cancelada(orden)

    if valor > orden.saldo_pendiente:
        raise ErrorNegocio(
            code='ABONO_EXCEDE_SALDO',
            message='El abono supera el saldo pendiente de la orden.',
            status_code=409,
            details={'saldo_pendiente': str(orden.saldo_pendiente)},
        )

    _validar_medio_pago_habilitado(medio_pago)

    ahora = fecha or timezone.now()
    estado_pago = _estado_pago_para(medio_pago)
    abono = Abono.objects.create(
        id=id or uuid.uuid4(),
        operation_id=operation_id,
        orden=orden,
        usuario=usuario,
        valor=valor,
        medio_pago=medio_pago,
        estado_pago=estado_pago,
        fecha=ahora,
        observacion=observacion,
    )

    MovimientoCaja.objects.create(
        usuario=usuario,
        abono=abono,
        tipo=MovimientoCaja.Tipo.INGRESO_ABONO,
        medio_pago=medio_pago,
        estado_pago=estado_pago,
        valor=valor,
        fecha=ahora,
        fecha_confirmacion=ahora if estado_pago == Abono.EstadoPago.CONFIRMADO else None,
    )

    orden.saldo_pendiente -= valor
    orden.save(update_fields=['saldo_pendiente'])
    return abono


# ---------------------------------------------------------------------------
# HU-041 — consumos
# ---------------------------------------------------------------------------

def registrar_consumo(*, orden, usuario, operation_id, producto, cantidad, id=None, fecha=None):
    """Contrato v2 §8 (CU-09, R-15): no valida existencias al registrarse."""
    _verificar_no_cancelada(orden)
    if orden.estado == OrdenTrabajo.Estado.ENTREGADO:
        raise ErrorNegocio(
            code='ORDEN_YA_ENTREGADA',
            message='La orden ya fue entregada.',
            status_code=409,
        )
    if not producto.activo:
        raise ErrorNegocio(
            code='PRODUCTO_INACTIVO',
            message=f'El producto "{producto.nombre}" está inactivo.',
            status_code=409,
            details={'producto_id': str(producto.id)},
        )

    return ConsumoOrden.objects.create(
        id=id or uuid.uuid4(),
        operation_id=operation_id,
        orden=orden,
        producto=producto,
        cantidad=cantidad,
        estado=ConsumoOrden.Estado.PENDIENTE,
        fecha_registro=fecha or timezone.now(),
    )


# ---------------------------------------------------------------------------
# HU-023 — costos operativos y utilidad neta (solo ADMIN)
# ---------------------------------------------------------------------------

def registrar_costo(*, orden, usuario, operation_id, concepto, valor, id=None):
    """Contrato v2 §8 (CU-10, R-16). Recalcula utilidad_neta = costo_total - suma de costos."""
    orden = OrdenTrabajo.objects.select_for_update().get(pk=orden.pk)
    _verificar_no_cancelada(orden)

    if orden.estado == OrdenTrabajo.Estado.ENTREGADO:
        raise ErrorNegocio(
            code='ORDEN_YA_ENTREGADA',
            message='La orden ya fue entregada.',
            status_code=409,
        )

    costo = CostoOperativoOrden.objects.create(
        id=id or uuid.uuid4(), operation_id=operation_id, orden=orden, concepto=concepto, valor=valor,
    )

    total_costos = orden.costos.aggregate(t=Sum('valor'))['t'] or Decimal('0')
    orden.utilidad_neta = orden.costo_total - total_costos
    orden.save(update_fields=['utilidad_neta'])
    return costo


# ---------------------------------------------------------------------------
# D29 (Lote 7, E-20) — cancelar orden (solo ADMIN)
# ---------------------------------------------------------------------------

def cancelar_orden(*, orden, usuario, motivo, fecha=None):
    """
    D29: PATCH /api/ordenes-trabajo/{id}/cancelar/. Solo en RECIBIDO,
    EN_PROCESO o LISTO (sobre ENTREGADO → 409 ORDEN_YA_ENTREGADA; sobre
    CANCELADA → 409 ORDEN_CANCELADA). Un abono que no esté ANULADO (incluidos
    los PENDIENTE_VERIFICACION) bloquea con 409 ORDEN_CON_ABONOS. Los consumos
    PENDIENTE quedan así para siempre: nunca se aplican al inventario.
    `fecha` (D18): fecha_cliente cuando llega por /api/sync/.
    """
    verificar_rol_admin(usuario)
    orden = OrdenTrabajo.objects.select_for_update().get(pk=orden.pk)
    _verificar_no_cancelada(orden)

    if orden.estado == OrdenTrabajo.Estado.ENTREGADO:
        raise ErrorNegocio(
            code='ORDEN_YA_ENTREGADA',
            message='La orden ya fue entregada.',
            status_code=409,
        )

    if orden.abonos.exclude(estado_pago=Abono.EstadoPago.ANULADO).exists():
        raise ErrorNegocio(
            code='ORDEN_CON_ABONOS',
            message=(
                'La orden tiene abonos registrados y no se puede cancelar. '
                'Si un pago electrónico no llegó, primero anule ese abono en Caja '
                '(pagos pendientes); los abonos anulados no bloquean la cancelación.'
            ),
            status_code=409,
        )

    orden.estado = OrdenTrabajo.Estado.CANCELADA
    orden.motivo_cancelacion = motivo
    orden.cancelada_por = usuario
    orden.fecha_cancelacion = fecha or timezone.now()
    orden.save(update_fields=['estado', 'motivo_cancelacion', 'cancelada_por', 'fecha_cancelacion'])
    return orden

"""Capa de servicios de Ventas y Mesas: reglas de negocio, no de forma (ADR-002)."""

import uuid
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from core.exceptions import ErrorNegocio
from core.models import ConfiguracionPago
from finanzas.models import MovimientoCaja
from inventario.models import Producto
from inventario.services import crear_salida_venta

from .models import DetalleVenta, Mesa, Venta

LIMITE_MESAS_ACTIVAS = 15


# ---------------------------------------------------------------------------
# Mesas (HU-043)
# ---------------------------------------------------------------------------

def _mesas_activas_bloqueadas():
    # select_for_update() no admite .count()/.aggregate() (Django lo
    # rechaza); se materializa la lista y se cuenta en Python.
    return list(Mesa.objects.select_for_update().filter(activa=True))


def crear_mesa(*, numero, operation_id):
    if len(_mesas_activas_bloqueadas()) >= LIMITE_MESAS_ACTIVAS:
        raise ErrorNegocio(
            code='LIMITE_MESAS_EXCEDIDO',
            message=f'La instalación ya tiene {LIMITE_MESAS_ACTIVAS} mesas activas.',
            status_code=409,
        )
    return Mesa.objects.create(operation_id=operation_id, numero=numero)


def editar_mesa(*, mesa, datos):
    """PATCH /api/mesas/{id}/ — Contrato v2 §7.1: solo activa es editable."""
    nueva_activa = datos.get('activa')
    if nueva_activa is not None and nueva_activa != mesa.activa:
        if nueva_activa is False:
            if mesa.estado == Mesa.Estado.OCUPADA:
                raise ErrorNegocio(
                    code='MESA_OCUPADA',
                    message='No se puede desactivar una mesa con una sesión abierta.',
                    status_code=409,
                )
        else:
            if len(_mesas_activas_bloqueadas()) >= LIMITE_MESAS_ACTIVAS:
                raise ErrorNegocio(
                    code='LIMITE_MESAS_EXCEDIDO',
                    message=f'La instalación ya tiene {LIMITE_MESAS_ACTIVAS} mesas activas.',
                    status_code=409,
                )
        mesa.activa = nueva_activa
        mesa.save(update_fields=['activa'])
    return mesa


# ---------------------------------------------------------------------------
# Ventas — venta rápida y sesiones dinámicas (HU-012, HU-013, HU-014, HU-015,
# HU-016, HU-017, HU-018, HU-019, HU-048)
# ---------------------------------------------------------------------------

def _validar_medio_pago_habilitado(medio_pago):
    configuracion = ConfiguracionPago.objects.obtener()
    habilitado = {
        Venta.MedioPago.EFECTIVO: configuracion.acepta_efectivo,
        Venta.MedioPago.TRANSFERENCIA: configuracion.acepta_transferencia,
        Venta.MedioPago.QR: configuracion.acepta_qr,
    }[medio_pago]
    if not habilitado:
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message=f'El medio de pago {medio_pago} no está habilitado en esta instalación.',
            status_code=400,
        )


def _estado_pago_para(medio_pago):
    return (
        Venta.EstadoPago.CONFIRMADO if medio_pago == Venta.MedioPago.EFECTIVO
        else Venta.EstadoPago.PENDIENTE_VERIFICACION
    )


def _bloquear_productos(detalles):
    """Bloquea (select_for_update) todos los productos de la operación, en un
    orden estable, para que dos operaciones simultáneas no dejen stock
    negativo ni se bloqueen entre sí en cruce (deadlock)."""
    producto_ids = sorted({str(d['producto'].id) for d in detalles})
    productos = Producto.objects.select_for_update().filter(id__in=producto_ids)
    return {str(p.id): p for p in productos}


def _validar_productos_activos(detalles, productos):
    for detalle in detalles:
        producto = productos[str(detalle['producto'].id)]
        if not producto.activo:
            raise ErrorNegocio(
                code='PRODUCTO_INACTIVO',
                message=f'El producto "{producto.nombre}" está inactivo.',
                status_code=409,
                details={'producto_id': str(producto.id)},
            )


def _validar_existencias(detalles, productos):
    """D12/R-19: valida TODA la operación antes de aplicar ningún efecto."""
    necesidad: dict[str, Decimal] = {}
    for detalle in detalles:
        producto = productos[str(detalle['producto'].id)]
        if producto.controla_stock:
            clave = str(producto.id)
            necesidad[clave] = necesidad.get(clave, Decimal('0')) + detalle['cantidad']

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
            message='Las existencias no alcanzan para completar la operación.',
            status_code=409,
            details={'productos': faltantes},
        )


def crear_venta_rapida(*, usuario, operation_id, medio_pago, detalles):
    """
    Contrato v2 §7, P-01: registra, en una sola operación, una Venta RAPIDA
    ya CERRADA con sus DetalleVenta, las salidas de inventario correspondientes
    y exactamente un MovimientoCaja INGRESO_VENTA. Si algo falla, no se
    registra nada (la sub-transacción de core.idempotencia revierte todo).
    """
    _validar_medio_pago_habilitado(medio_pago)

    productos = _bloquear_productos(detalles)
    _validar_productos_activos(detalles, productos)
    _validar_existencias(detalles, productos)

    ahora = timezone.now()
    estado_pago = _estado_pago_para(medio_pago)
    venta = Venta.objects.create(
        operation_id=operation_id,
        tipo=Venta.Tipo.RAPIDA,
        usuario=usuario,
        mesa=None,
        estado=Venta.Estado.CERRADA,
        fecha_apertura=ahora,
        fecha_cierre=ahora,
        medio_pago=medio_pago,
        estado_pago=estado_pago,
    )

    total = Decimal('0')
    for detalle in detalles:
        producto = productos[str(detalle['producto'].id)]
        cantidad = detalle['cantidad']
        precio_unitario = producto.precio_venta
        subtotal = precio_unitario * cantidad
        total += subtotal
        DetalleVenta.objects.create(
            operation_id=detalle.get('operation_id') or uuid.uuid4(),
            venta=venta,
            producto=producto,
            cantidad=cantidad,
            precio_unitario=precio_unitario,
            subtotal=subtotal,
        )
        if producto.controla_stock:
            crear_salida_venta(producto=producto, usuario=usuario, venta=venta, cantidad=cantidad)

    venta.total = total
    venta.save(update_fields=['total'])

    MovimientoCaja.objects.create(
        usuario=usuario,
        venta=venta,
        tipo=MovimientoCaja.Tipo.INGRESO_VENTA,
        medio_pago=medio_pago,
        estado_pago=estado_pago,
        valor=total,
        fecha=ahora,
        fecha_confirmacion=ahora if estado_pago == Venta.EstadoPago.CONFIRMADO else None,
    )
    return venta


def abrir_sesion_dinamica(*, usuario, operation_id, mesa):
    """Contrato v2 §7 (CU-02): abre una SESION_DINAMICA sin detalles ni medio de pago."""
    if not mesa.activa:
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message='La mesa está inactiva.',
            status_code=400,
        )

    try:
        with transaction.atomic():
            venta = Venta.objects.create(
                operation_id=operation_id,
                tipo=Venta.Tipo.SESION_DINAMICA,
                usuario=usuario,
                mesa=mesa,
                estado=Venta.Estado.ABIERTA,
            )
    except IntegrityError:
        # R-08: el índice único parcial (mesa, estado=ABIERTA) es lo que
        # realmente serializa dos aperturas simultáneas en la misma mesa;
        # la que pierde la carrera llega aquí.
        raise ErrorNegocio(
            code='MESA_OCUPADA',
            message='La mesa ya tiene una sesión abierta.',
            status_code=409,
        )

    mesa_bloqueada = Mesa.objects.select_for_update().get(pk=mesa.pk)
    mesa_bloqueada.estado = Mesa.Estado.OCUPADA
    mesa_bloqueada.save(update_fields=['estado'])
    return venta


def _recalcular_total(venta):
    total = venta.detalles.aggregate(t=Sum('subtotal'))['t'] or Decimal('0')
    venta.total = total
    venta.save(update_fields=['total'])
    return venta


def agregar_detalle(*, venta, producto, cantidad, operation_id=None):
    """Contrato v2 §7 (CU-03): acumula sin afectar existencias (R-09)."""
    if venta.estado != Venta.Estado.ABIERTA:
        raise ErrorNegocio(
            code='VENTA_YA_CERRADA',
            message='La venta ya está cerrada o cancelada.',
            status_code=409,
        )
    if not producto.activo:
        raise ErrorNegocio(
            code='PRODUCTO_INACTIVO',
            message=f'El producto "{producto.nombre}" está inactivo.',
            status_code=409,
            details={'producto_id': str(producto.id)},
        )

    precio_unitario = producto.precio_venta
    detalle = DetalleVenta.objects.create(
        operation_id=operation_id or uuid.uuid4(),
        venta=venta,
        producto=producto,
        cantidad=cantidad,
        precio_unitario=precio_unitario,
        subtotal=precio_unitario * cantidad,
    )
    _recalcular_total(venta)
    return detalle


def quitar_detalle(*, venta, detalle):
    """D11: única excepción a «nada se borra físicamente» (D7) — la línea
    nunca generó efectos porque la venta seguía ABIERTA."""
    if venta.estado != Venta.Estado.ABIERTA:
        raise ErrorNegocio(
            code='VENTA_YA_CERRADA',
            message='La venta ya está cerrada o cancelada.',
            status_code=409,
        )
    detalle.delete()
    _recalcular_total(venta)


def cerrar_venta(*, venta, usuario, medio_pago):
    """
    Contrato v2 §7 (CU-04, R-10): cierra la venta, valida existencias (D12,
    R-19) y genera sus efectos en una sola transacción.
    """
    venta = Venta.objects.select_for_update().get(pk=venta.pk)
    if venta.estado != Venta.Estado.ABIERTA:
        raise ErrorNegocio(
            code='VENTA_YA_CERRADA',
            message='La venta ya está cerrada o cancelada.',
            status_code=409,
        )

    detalles_bd = list(venta.detalles.select_related('producto'))
    if not detalles_bd:
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message='Una sesión sin detalles no puede cerrarse; puede cancelarse.',
            status_code=400,
        )

    _validar_medio_pago_habilitado(medio_pago)

    detalles = [{'producto': d.producto, 'cantidad': d.cantidad} for d in detalles_bd]
    productos = _bloquear_productos(detalles)
    # D12: valida TODAS las existencias antes de aplicar cualquier efecto; si
    # falta alguna, la sesión sigue ABIERTA y la mesa sigue OCUPADA.
    _validar_existencias(detalles, productos)

    ahora = timezone.now()
    estado_pago = _estado_pago_para(medio_pago)

    for detalle in detalles_bd:
        producto = productos[str(detalle.producto_id)]
        if producto.controla_stock:
            crear_salida_venta(producto=producto, usuario=usuario, venta=venta, cantidad=detalle.cantidad)

    venta.estado = Venta.Estado.CERRADA
    venta.fecha_cierre = ahora
    venta.medio_pago = medio_pago
    venta.estado_pago = estado_pago
    venta.save(update_fields=['estado', 'fecha_cierre', 'medio_pago', 'estado_pago'])

    MovimientoCaja.objects.create(
        usuario=usuario,
        venta=venta,
        tipo=MovimientoCaja.Tipo.INGRESO_VENTA,
        medio_pago=medio_pago,
        estado_pago=estado_pago,
        valor=venta.total,
        fecha=ahora,
        fecha_confirmacion=ahora if estado_pago == Venta.EstadoPago.CONFIRMADO else None,
    )

    if venta.tipo == Venta.Tipo.SESION_DINAMICA:
        mesa = Mesa.objects.select_for_update().get(pk=venta.mesa_id)
        mesa.estado = Mesa.Estado.DISPONIBLE
        mesa.save(update_fields=['estado'])

    return venta


def cancelar_venta(*, venta):
    """Contrato v2 §7 (CU-04 alterno, R-11): sin efectos; libera la mesa."""
    venta = Venta.objects.select_for_update().get(pk=venta.pk)
    if venta.estado != Venta.Estado.ABIERTA:
        raise ErrorNegocio(
            code='VENTA_YA_CERRADA',
            message='La venta ya está cerrada o cancelada.',
            status_code=409,
        )

    venta.estado = Venta.Estado.CANCELADA
    venta.save(update_fields=['estado'])

    if venta.tipo == Venta.Tipo.SESION_DINAMICA:
        mesa = Mesa.objects.select_for_update().get(pk=venta.mesa_id)
        mesa.estado = Mesa.Estado.DISPONIBLE
        mesa.save(update_fields=['estado'])

    return venta

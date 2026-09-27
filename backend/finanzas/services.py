"""Capa de servicios de Caja: gastos, confirmación/anulación de pagos, resumen y cierre."""

import uuid
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from core.exceptions import ErrorNegocio
from core.models import ConfiguracionPago
from servicios.models import Abono, OrdenTrabajo
from ventas.models import Venta

from .models import CierreCaja, MovimientoCaja


def _validar_medio_pago_habilitado(medio_pago):
    configuracion = ConfiguracionPago.objects.obtener()
    habilitado = {
        MovimientoCaja.MedioPago.EFECTIVO: configuracion.acepta_efectivo,
        MovimientoCaja.MedioPago.TRANSFERENCIA: configuracion.acepta_transferencia,
        MovimientoCaja.MedioPago.QR: configuracion.acepta_qr,
    }[medio_pago]
    if not habilitado:
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message=f'El medio de pago {medio_pago} no está habilitado en esta instalación.',
            status_code=400,
        )


def _estado_pago_para(medio_pago):
    return (
        MovimientoCaja.EstadoPago.CONFIRMADO if medio_pago == MovimientoCaja.MedioPago.EFECTIVO
        else MovimientoCaja.EstadoPago.PENDIENTE_VERIFICACION
    )


# ---------------------------------------------------------------------------
# HU-029 — gastos
# ---------------------------------------------------------------------------

def registrar_gasto(*, usuario, operation_id, medio_pago, valor, concepto, id=None, fecha=None):
    """Contrato v2 §10 (CU-14, R-21): POST /api/movimientos-caja/, ambos roles."""
    _validar_medio_pago_habilitado(medio_pago)

    ahora = fecha or timezone.now()
    estado_pago = _estado_pago_para(medio_pago)
    return MovimientoCaja.objects.create(
        id=id or uuid.uuid4(),
        operation_id=operation_id,
        usuario=usuario,
        tipo=MovimientoCaja.Tipo.GASTO,
        medio_pago=medio_pago,
        estado_pago=estado_pago,
        valor=valor,
        concepto=concepto,
        fecha=ahora,
        fecha_confirmacion=ahora if estado_pago == MovimientoCaja.EstadoPago.CONFIRMADO else None,
    )


# ---------------------------------------------------------------------------
# HU-050 — confirmar / D15 — anular pagos electrónicos
# ---------------------------------------------------------------------------

def confirmar_movimiento(*, movimiento, usuario):
    """
    Contrato v2 §10 (P-02): solo un movimiento PENDIENTE_VERIFICACION puede
    confirmarse (si no, 409 PAGO_YA_CONFIRMADO). Actualiza estado_pago y
    fecha_confirmacion en el movimiento y en su Venta o Abono de origen, en
    la misma transacción. Los gastos no tienen origen que actualizar.
    """
    movimiento = MovimientoCaja.objects.select_for_update().get(pk=movimiento.pk)
    if movimiento.estado_pago != MovimientoCaja.EstadoPago.PENDIENTE_VERIFICACION:
        raise ErrorNegocio(
            code='PAGO_YA_CONFIRMADO',
            message='El movimiento ya fue confirmado, anulado o no está pendiente de verificación.',
            status_code=409,
        )

    ahora = timezone.now()
    movimiento.estado_pago = MovimientoCaja.EstadoPago.CONFIRMADO
    movimiento.fecha_confirmacion = ahora
    movimiento.save(update_fields=['estado_pago', 'fecha_confirmacion'])

    if movimiento.tipo == MovimientoCaja.Tipo.INGRESO_VENTA:
        venta = Venta.objects.select_for_update().get(pk=movimiento.venta_id)
        venta.estado_pago = Venta.EstadoPago.CONFIRMADO
        venta.save(update_fields=['estado_pago'])
    elif movimiento.tipo == MovimientoCaja.Tipo.INGRESO_ABONO:
        abono = Abono.objects.select_for_update().get(pk=movimiento.abono_id)
        abono.estado_pago = Abono.EstadoPago.CONFIRMADO
        abono.save(update_fields=['estado_pago'])

    return movimiento


def anular_movimiento(*, movimiento, usuario, motivo):
    """
    D15: PATCH /api/movimientos-caja/{id}/anular/, solo ADMIN, con motivo
    obligatorio. Solo aplica sobre PENDIENTE_VERIFICACION (si no, 409
    PAGO_YA_CONFIRMADO). Al anular un abono, su valor vuelve al
    saldo_pendiente de la orden. No se revierte inventario: la mercancía ya
    salió (desviación intencional del ERD, documentada en CLAUDE.md).
    """
    movimiento = MovimientoCaja.objects.select_for_update().get(pk=movimiento.pk)
    if movimiento.estado_pago != MovimientoCaja.EstadoPago.PENDIENTE_VERIFICACION:
        raise ErrorNegocio(
            code='PAGO_YA_CONFIRMADO',
            message='Solo se puede anular un movimiento pendiente de verificación.',
            status_code=409,
        )

    movimiento.estado_pago = MovimientoCaja.EstadoPago.ANULADO
    movimiento.motivo_anulacion = motivo
    movimiento.save(update_fields=['estado_pago', 'motivo_anulacion'])

    if movimiento.tipo == MovimientoCaja.Tipo.INGRESO_VENTA:
        venta = Venta.objects.select_for_update().get(pk=movimiento.venta_id)
        venta.estado_pago = Venta.EstadoPago.ANULADO
        venta.save(update_fields=['estado_pago'])
    elif movimiento.tipo == MovimientoCaja.Tipo.INGRESO_ABONO:
        abono = Abono.objects.select_for_update().get(pk=movimiento.abono_id)
        abono.estado_pago = Abono.EstadoPago.ANULADO
        abono.save(update_fields=['estado_pago'])

        orden = OrdenTrabajo.objects.select_for_update().get(pk=abono.orden_id)
        orden.saldo_pendiente += abono.valor
        orden.save(update_fields=['saldo_pendiente'])

    return movimiento


# ---------------------------------------------------------------------------
# HU-027 — resumen del día
# ---------------------------------------------------------------------------

def _limites_del_dia(fecha):
    tz = timezone.get_current_timezone()
    inicio = timezone.make_aware(datetime.combine(fecha, time.min), tz)
    fin = inicio + timedelta(days=1)
    return inicio, fin


def calcular_resumen(*, fecha):
    """
    Contrato v2 §10 (CU-20), calculado sobre el día LOCAL (America/Bogota,
    D10). Incluye todos los movimientos del día, confirmados o no, salvo los
    ANULADO (D15: un movimiento anulado no cuenta como ingreso en el resumen).
    """
    inicio, fin = _limites_del_dia(fecha)
    movimientos = (
        MovimientoCaja.objects.filter(fecha__gte=inicio, fecha__lt=fin)
        .exclude(estado_pago=MovimientoCaja.EstadoPago.ANULADO)
    )

    def _suma(queryset):
        return queryset.aggregate(t=Sum('valor'))['t'] or Decimal('0')

    ingresos_ventas = _suma(movimientos.filter(tipo=MovimientoCaja.Tipo.INGRESO_VENTA))
    ingresos_abonos = _suma(movimientos.filter(tipo=MovimientoCaja.Tipo.INGRESO_ABONO))
    gastos = _suma(movimientos.filter(tipo=MovimientoCaja.Tipo.GASTO))
    neto = ingresos_ventas + ingresos_abonos - gastos

    ingresos = movimientos.exclude(tipo=MovimientoCaja.Tipo.GASTO)
    por_medio_pago = {
        medio: _suma(ingresos.filter(medio_pago=medio))
        for medio, _ in MovimientoCaja.MedioPago.choices
    }
    pendiente_verificacion = _suma(
        ingresos.filter(estado_pago=MovimientoCaja.EstadoPago.PENDIENTE_VERIFICACION)
    )

    return {
        'fecha': fecha,
        'ingresos_ventas': ingresos_ventas,
        'ingresos_abonos': ingresos_abonos,
        'gastos': gastos,
        'neto': neto,
        'por_medio_pago': por_medio_pago,
        'pendiente_verificacion': pendiente_verificacion,
    }


# ---------------------------------------------------------------------------
# HU-028 — cierre de caja
# ---------------------------------------------------------------------------

def crear_cierre(*, usuario, operation_id, fecha, efectivo_contado, observaciones=None):
    """
    Contrato v2 §11 (CU-15), D14: consolida los MovimientoCaja CONFIRMADO con
    cierre_caja_id nulo cuya fecha sea <= periodo_fin (no un rango fijo).
    select_for_update() sobre esos movimientos evita que dos cierres
    simultáneos consoliden el mismo movimiento dos veces.
    """
    periodo_fin = timezone.now()

    ultimo_cierre = CierreCaja.objects.order_by('-periodo_fin').first()
    if ultimo_cierre is not None:
        periodo_inicio = ultimo_cierre.periodo_fin
    else:
        primero = MovimientoCaja.objects.order_by('fecha').first()
        periodo_inicio = primero.fecha if primero else None

    # CHECK cierrecaja_periodo_fin_mayor exige periodo_fin > periodo_inicio.
    # Dos timezone.now() muy seguidos (crear el movimiento y, justo después,
    # calcular periodo_fin aquí) pueden coincidir al microsegundo si el reloj
    # del sistema operativo no alcanza a avanzar entre una llamada y otra
    # (más notorio en Windows) — sin esta guarda, esa coincidencia hacía
    # fallar el INSERT con el CHECK, y el except de abajo lo reportaba mal
    # como CIERRE_YA_REALIZADO.
    if periodo_inicio is None or periodo_inicio >= periodo_fin:
        periodo_inicio = periodo_fin - timedelta(microseconds=1)

    movimientos = list(
        MovimientoCaja.objects.select_for_update().filter(
            estado_pago=MovimientoCaja.EstadoPago.CONFIRMADO,
            cierre_caja__isnull=True,
            fecha__lte=periodo_fin,
        )
    )

    def _suma(tipo):
        return sum((m.valor for m in movimientos if m.tipo == tipo), Decimal('0'))

    total_ingresos_ventas = _suma(MovimientoCaja.Tipo.INGRESO_VENTA)
    total_ingresos_abonos = _suma(MovimientoCaja.Tipo.INGRESO_ABONO)
    total_gastos = _suma(MovimientoCaja.Tipo.GASTO)
    total_neto = total_ingresos_ventas + total_ingresos_abonos - total_gastos

    ingresos_efectivo = sum(
        (m.valor for m in movimientos if m.medio_pago == MovimientoCaja.MedioPago.EFECTIVO and m.tipo != MovimientoCaja.Tipo.GASTO),
        Decimal('0'),
    )
    gastos_efectivo = sum(
        (m.valor for m in movimientos if m.medio_pago == MovimientoCaja.MedioPago.EFECTIVO and m.tipo == MovimientoCaja.Tipo.GASTO),
        Decimal('0'),
    )
    efectivo_esperado = ingresos_efectivo - gastos_efectivo
    diferencia = efectivo_contado - efectivo_esperado

    if diferencia != 0 and not observaciones:
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message='observaciones es obligatorio cuando hay una diferencia en el arqueo.',
            status_code=400,
            details={'observaciones': 'Es obligatorio cuando la diferencia no es cero.'},
        )

    try:
        with transaction.atomic():
            cierre = CierreCaja.objects.create(
                operation_id=operation_id,
                usuario=usuario,
                fecha=fecha,
                periodo_inicio=periodo_inicio,
                periodo_fin=periodo_fin,
                total_ingresos_ventas=total_ingresos_ventas,
                total_ingresos_abonos=total_ingresos_abonos,
                total_gastos=total_gastos,
                total_neto=total_neto,
                efectivo_esperado=efectivo_esperado,
                efectivo_contado=efectivo_contado,
                diferencia=diferencia,
                observaciones=observaciones,
            )
    except IntegrityError as exc:
        constraint = getattr(getattr(exc.__cause__, 'diag', None), 'constraint_name', None)
        if constraint == 'cierrecaja_periodo_fin_mayor':
            # La guarda de arriba debería impedir esto siempre; si de todos
            # modos ocurre, es un bug real y no un cierre duplicado — no lo
            # disfracemos de CIERRE_YA_REALIZADO.
            raise
        # R-25 / ERD §5.16: fecha es UNIQUE — a lo sumo un cierre por día.
        raise ErrorNegocio(
            code='CIERRE_YA_REALIZADO',
            message='Ya existe un cierre de caja registrado para esta fecha.',
            status_code=409,
        )

    if movimientos:
        MovimientoCaja.objects.filter(id__in=[m.id for m in movimientos]).update(cierre_caja=cierre)

    return cierre

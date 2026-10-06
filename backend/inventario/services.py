"""Capa de servicios del catálogo e inventario: reglas de negocio, no de forma (ADR-002)."""

import uuid

from django.utils import timezone

from core.exceptions import ErrorNegocio
from core.permissions import verificar_modulo_activo

from .models import MovimientoInventario, Producto


def editar_producto(*, producto, datos):
    """
    Contrato API v2 §6 (P-07): controla_stock solo puede cambiar cuando
    stock_actual = 0; en otro caso, 409 PRODUCTO_CON_EXISTENCIAS.
    """
    nuevo_controla_stock = datos.get('controla_stock')
    if nuevo_controla_stock is not None and nuevo_controla_stock != producto.controla_stock:
        if producto.stock_actual != 0:
            raise ErrorNegocio(
                code='PRODUCTO_CON_EXISTENCIAS',
                message=(
                    'No se puede cambiar controla_stock mientras el producto '
                    'tiene existencias distintas de cero.'
                ),
                status_code=409,
                details={'stock_actual': str(producto.stock_actual)},
            )

    for campo, valor in datos.items():
        setattr(producto, campo, valor)
    producto.save()
    return producto


def _concepto_compra(producto, cantidad, motivo):
    """D31: «Compra: <producto> × <cantidad>» (más el motivo si lo hay), dentro de 255 caracteres."""
    concepto = f'Compra: {producto.nombre} × {format(cantidad.normalize(), "f")}'
    if motivo:
        concepto = f'{concepto} — {motivo}'
    return concepto[:255]


def registrar_entrada(*, usuario, producto, cantidad, operation_id, motivo=None, id=None, fecha=None,
                      costo_total=None, medio_pago=None):
    """
    POST /api/inventario/movimientos/ con tipo=ENTRADA (Contrato v2 §9,
    HU-025). select_for_update evita que dos ingresos simultáneos del mismo
    producto se pisen entre sí.

    `id` y `fecha` son opcionales: /api/sync/ (Bloque 5a, D17/D18) los pasa
    con el id generado por el dispositivo y fecha_cliente como fecha de
    negocio; en línea se omiten y el modelo usa sus valores por defecto.

    D31 (Lote 7, E-23): con `costo_total` (> 0) se crea además, en la misma
    transacción, un MovimientoCaja GASTO enlazado por movimiento_inventario,
    con las reglas de siempre de registrar_gasto (medio habilitado; EFECTIVO
    → CONFIRMADO, TRANSFERENCIA/QR → PENDIENTE_VERIFICACION). Si el gasto
    falla, la transacción del llamador revierte también la ENTRADA.
    """
    if costo_total is not None and not medio_pago:
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message='medio_pago es obligatorio cuando se informa costo_total.',
            status_code=400,
            details={'medio_pago': 'Es obligatorio cuando se informa costo_total.'},
        )
    if medio_pago and costo_total is None:
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message='medio_pago solo aplica cuando se informa costo_total.',
            status_code=400,
            details={'medio_pago': 'Solo aplica cuando se informa costo_total.'},
        )
    if costo_total is not None and costo_total <= 0:
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message='costo_total debe ser mayor que cero.',
            status_code=400,
            details={'costo_total': 'Debe ser mayor que cero.'},
        )
    if costo_total is not None:
        # El gasto vive en Caja: con el módulo de finanzas apagado se rechaza
        # la operación completa (HU-042), no solo el gasto.
        verificar_modulo_activo('finanzas')

    ahora = fecha or timezone.now()
    producto = Producto.objects.select_for_update().get(pk=producto.pk)
    producto.stock_actual += cantidad
    producto.save(update_fields=['stock_actual'])
    movimiento = MovimientoInventario.objects.create(
        id=id or uuid.uuid4(),
        operation_id=operation_id,
        producto=producto,
        usuario=usuario,
        tipo=MovimientoInventario.Tipo.ENTRADA,
        cantidad=cantidad,
        motivo=motivo,
        fecha=ahora,
    )

    if costo_total is not None:
        from finanzas.services import registrar_gasto
        registrar_gasto(
            usuario=usuario, operation_id=uuid.uuid4(), medio_pago=medio_pago, valor=costo_total,
            concepto=_concepto_compra(producto, cantidad, motivo), fecha=ahora,
            movimiento_inventario=movimiento,
        )
    return movimiento


def registrar_merma(*, usuario, producto, cantidad, operation_id, motivo, id=None, fecha=None):
    """
    POST /api/inventario/movimientos/ con tipo=MERMA (Contrato v2 §9, HU-026,
    solo ADMIN — verificado por el llamador). Una merma que deje stock
    negativo responde 409 STOCK_INSUFICIENTE (R-19), sin aplicar nada.
    """
    producto = Producto.objects.select_for_update().get(pk=producto.pk)
    if producto.stock_actual - cantidad < 0:
        raise ErrorNegocio(
            code='STOCK_INSUFICIENTE',
            message='La merma dejaría el stock por debajo de cero.',
            status_code=409,
            details={
                'producto_id': str(producto.id),
                'disponible': str(producto.stock_actual),
                'solicitado': str(cantidad),
            },
        )
    producto.stock_actual -= cantidad
    producto.save(update_fields=['stock_actual'])
    return MovimientoInventario.objects.create(
        id=id or uuid.uuid4(),
        operation_id=operation_id,
        producto=producto,
        usuario=usuario,
        tipo=MovimientoInventario.Tipo.MERMA,
        cantidad=cantidad,
        motivo=motivo,
        fecha=fecha or timezone.now(),
    )


def registrar_ajuste_manual(*, usuario, producto, cantidad, sentido, operation_id, motivo, id=None, fecha=None):
    """
    POST /api/inventario/movimientos/ con tipo=AJUSTE_MANUAL (Contrato v2 §9,
    HU-026, solo ADMIN — verificado por el llamador). Un RESTA que deje stock
    negativo responde 409 STOCK_INSUFICIENTE (R-19), sin aplicar nada.
    """
    producto = Producto.objects.select_for_update().get(pk=producto.pk)
    delta = cantidad if sentido == MovimientoInventario.Sentido.SUMA else -cantidad
    nuevo_stock = producto.stock_actual + delta
    if nuevo_stock < 0:
        raise ErrorNegocio(
            code='STOCK_INSUFICIENTE',
            message='El ajuste dejaría el stock por debajo de cero.',
            status_code=409,
            details={
                'producto_id': str(producto.id),
                'disponible': str(producto.stock_actual),
                'solicitado': str(cantidad),
            },
        )
    producto.stock_actual = nuevo_stock
    producto.save(update_fields=['stock_actual'])
    return MovimientoInventario.objects.create(
        id=id or uuid.uuid4(),
        operation_id=operation_id,
        producto=producto,
        usuario=usuario,
        tipo=MovimientoInventario.Tipo.AJUSTE_MANUAL,
        cantidad=cantidad,
        sentido=sentido,
        motivo=motivo,
        fecha=fecha or timezone.now(),
    )


def registrar_movimiento(*, usuario, operation_id, tipo, producto, cantidad, motivo=None, sentido=None,
                          id=None, fecha=None, costo_total=None, medio_pago=None):
    """
    Despacha por tipo (Contrato v2 §9): ENTRADA es de ambos roles; MERMA y
    AJUSTE_MANUAL exigen ADMIN (403 PERMISO_INSUFICIENTE si no lo es) porque
    dependen del contenido del cuerpo, no solo del método HTTP. Único punto
    de entrada tanto para POST /api/inventario/movimientos/ como para
    /api/sync/ (inventario.movimientos CREATE, D17).
    """
    if tipo == MovimientoInventario.Tipo.ENTRADA:
        return registrar_entrada(
            usuario=usuario, producto=producto, cantidad=cantidad, operation_id=operation_id,
            motivo=motivo, id=id, fecha=fecha, costo_total=costo_total, medio_pago=medio_pago,
        )

    if costo_total is not None or medio_pago:
        # D31: el costo de compra solo acompaña a una ENTRADA.
        raise ErrorNegocio(
            code='DATOS_INVALIDOS',
            message='costo_total y medio_pago solo aplican a movimientos de tipo ENTRADA.',
            status_code=400,
        )

    if getattr(usuario, 'rol', None) != 'ADMIN':
        raise ErrorNegocio(
            code='PERMISO_INSUFICIENTE',
            message=f'Solo un ADMIN puede registrar movimientos de tipo {tipo}.',
            status_code=403,
        )

    if tipo == MovimientoInventario.Tipo.MERMA:
        return registrar_merma(
            usuario=usuario, producto=producto, cantidad=cantidad, operation_id=operation_id,
            motivo=motivo, id=id, fecha=fecha,
        )

    return registrar_ajuste_manual(
        usuario=usuario, producto=producto, cantidad=cantidad, sentido=sentido,
        operation_id=operation_id, motivo=motivo, id=id, fecha=fecha,
    )


def crear_salida_venta(*, producto, usuario, venta, cantidad, fecha=None):
    """
    Efecto de cerrar una Venta (R-10, R-18): un MovimientoInventario
    SALIDA_VENTA por cada línea cuyo producto controla_stock = true. El
    llamador (ventas.services) ya bloqueó `producto` con select_for_update()
    dentro de su propia transacción y ya validó que hay existencias
    suficientes (D12) antes de invocar esta función, así que aquí solo se
    aplica el efecto. `fecha` (D18): fecha_cliente cuando el cierre viene de
    /api/sync/; la hora del servidor en línea.
    """
    producto.stock_actual -= cantidad
    producto.save(update_fields=['stock_actual'])
    return MovimientoInventario.objects.create(
        producto=producto,
        usuario=usuario,
        venta=venta,
        tipo=MovimientoInventario.Tipo.SALIDA_VENTA,
        cantidad=cantidad,
        fecha=fecha or timezone.now(),
    )


def crear_salida_servicio(*, producto, usuario, consumo_orden, cantidad, fecha=None):
    """
    Efecto de entregar una OrdenTrabajo (R-15, R-18, Bloque 3): un
    MovimientoInventario SALIDA_SERVICIO por cada ConsumoOrden PENDIENTE cuyo
    producto controla_stock = true. El llamador (servicios.services) ya
    bloqueó `producto` con select_for_update() y ya validó existencias
    (equivalente a D12) antes de invocar esta función.
    """
    producto.stock_actual -= cantidad
    producto.save(update_fields=['stock_actual'])
    return MovimientoInventario.objects.create(
        producto=producto,
        usuario=usuario,
        consumo_orden=consumo_orden,
        tipo=MovimientoInventario.Tipo.SALIDA_SERVICIO,
        cantidad=cantidad,
        fecha=fecha or timezone.now(),
    )

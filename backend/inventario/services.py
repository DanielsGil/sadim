"""Capa de servicios del catálogo e inventario: reglas de negocio, no de forma (ADR-002)."""

from core.exceptions import ErrorNegocio

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


def registrar_entrada(*, usuario, producto, cantidad, operation_id, motivo=None):
    """
    POST /api/inventario/movimientos/ con tipo=ENTRADA (Contrato v2 §9,
    HU-025 adelantado). select_for_update evita que dos ingresos simultáneos
    del mismo producto se pisen entre sí.
    """
    producto = Producto.objects.select_for_update().get(pk=producto.pk)
    producto.stock_actual += cantidad
    producto.save(update_fields=['stock_actual'])
    return MovimientoInventario.objects.create(
        operation_id=operation_id,
        producto=producto,
        usuario=usuario,
        tipo=MovimientoInventario.Tipo.ENTRADA,
        cantidad=cantidad,
        motivo=motivo,
    )


def crear_salida_venta(*, producto, usuario, venta, cantidad):
    """
    Efecto de cerrar una Venta (R-10, R-18): un MovimientoInventario
    SALIDA_VENTA por cada línea cuyo producto controla_stock = true. El
    llamador (ventas.services) ya bloqueó `producto` con select_for_update()
    dentro de su propia transacción y ya validó que hay existencias
    suficientes (D12) antes de invocar esta función, así que aquí solo se
    aplica el efecto.
    """
    producto.stock_actual -= cantidad
    producto.save(update_fields=['stock_actual'])
    return MovimientoInventario.objects.create(
        producto=producto,
        usuario=usuario,
        venta=venta,
        tipo=MovimientoInventario.Tipo.SALIDA_VENTA,
        cantidad=cantidad,
    )

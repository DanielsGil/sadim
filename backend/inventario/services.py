"""Capa de servicios del catálogo: reglas de negocio, no de forma (ADR-002)."""

from core.exceptions import ErrorNegocio


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

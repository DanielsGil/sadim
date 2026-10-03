import type { Producto } from '../tipos/dominio'

/** E-12: lógica de la bandeja de selección, compartida por la sesión de mesa y la venta rápida. */
export interface ItemBandeja {
  producto: Producto
  cantidad: number
  /** Error del último envío de esta línea (se conserva en la bandeja para reintentar). */
  error?: string
  /** Advertencia no bloqueante, p. ej. stock local insuficiente (D22). */
  aviso?: string
}

/** Suma `cantidad` al producto en la bandeja (una sola línea por producto). */
export function sumarABandeja(items: ItemBandeja[], producto: Producto, cantidad = 1): ItemBandeja[] {
  if (items.some((item) => item.producto.id === producto.id)) {
    return items.map((item) =>
      item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + cantidad, error: undefined } : item,
    )
  }
  return [...items, { producto, cantidad }]
}

export function unidadesEnBandeja(items: ItemBandeja[]): number {
  return items.reduce((suma, item) => suma + item.cantidad, 0)
}

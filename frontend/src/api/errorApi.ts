/** Espejo de la forma de error del Contrato API §14: {code, message, details}. */
export class ErrorApi extends Error {
  code: string
  details: Record<string, unknown>

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ErrorApi'
    this.code = code
    this.details = details
  }
}

interface ProductoFaltante {
  nombre?: string
  disponible?: string
  requerido?: string
}

/**
 * Mensaje claro para mostrar según el `code` del backend. Para
 * STOCK_INSUFICIENTE (D24/D12) nombra los productos con lo disponible y lo
 * requerido; para el resto usa el `message` del Contrato §14.
 */
export function mensajeErrorApi(err: unknown, porDefecto: string): string {
  if (!(err instanceof ErrorApi)) return porDefecto
  if (err.code === 'STOCK_INSUFICIENTE') {
    const productos = (err.details.productos as ProductoFaltante[] | undefined) ?? []
    if (productos.length > 0) {
      const detalle = productos
        .map((p) => `${p.nombre ?? 'producto'} (disponible: ${p.disponible ?? '?'}, pedido: ${p.requerido ?? '?'})`)
        .join('; ')
      return `No hay existencias suficientes: ${detalle}.`
    }
    return 'No hay existencias suficientes para esta operación.'
  }
  return err.message
}

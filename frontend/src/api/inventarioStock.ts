import type { StockProducto } from '../tipos/dominio'
import { estaEnLinea } from '../sync/cacheCatalogo'
import { hayPendientesDe } from '../sync/pendientes'
import { listarStockLocal } from '../sync/vistaLocalInventarioCaja'
import { peticion } from './cliente'

// Contrato API v2 §9 (HU-024). Ambos roles. Sin conexión se deriva de la
// copia local del catálogo (ya ajustada con los movimientos en cola): es
// provisional (D22).

export async function listarStock(categoriaId?: string, tipo?: string): Promise<StockProducto[]> {
  const parametros = new URLSearchParams()
  if (categoriaId) parametros.set('categoria', categoriaId)
  if (tipo) parametros.set('tipo', tipo)
  const cadena = parametros.toString()
  // Con movimientos sin sincronizar, el stock del servidor aún no los refleja: se muestra el provisional.
  if (await hayPendientesDe('inventario.movimientos', 'ordenes-trabajo.estado')) {
    const local = await listarStockLocal(categoriaId, tipo)
    if (local.length > 0) return local
  }
  try {
    return await peticion<StockProducto[]>(`/inventario/stock/${cadena ? `?${cadena}` : ''}`)
  } catch (error) {
    if (estaEnLinea()) throw error
    return listarStockLocal(categoriaId, tipo)
  }
}

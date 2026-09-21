import type { StockProducto } from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato API v2 §9 (HU-024). Ambos roles.

export function listarStock(categoriaId?: string, tipo?: string): Promise<StockProducto[]> {
  const parametros = new URLSearchParams()
  if (categoriaId) parametros.set('categoria', categoriaId)
  if (tipo) parametros.set('tipo', tipo)
  const cadena = parametros.toString()
  return peticion<StockProducto[]>(`/inventario/stock/${cadena ? `?${cadena}` : ''}`)
}

import { v4 as uuidv4 } from 'uuid'
import type { MovimientoInventario } from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato API v2 §9 (HU-025, adelanto). Por ahora solo ENTRADA; ambos roles.

export function listarMovimientos(productoId?: string): Promise<MovimientoInventario[]> {
  const cadena = productoId ? `?producto=${productoId}` : ''
  return peticion<MovimientoInventario[]>(`/inventario/movimientos/${cadena}`)
}

export function registrarEntrada(
  productoId: string,
  cantidad: number,
  motivo: string,
): Promise<MovimientoInventario> {
  return peticion<MovimientoInventario>('/inventario/movimientos/', {
    method: 'POST',
    body: JSON.stringify({
      operation_id: uuidv4(),
      producto_id: productoId,
      tipo: 'ENTRADA',
      cantidad,
      motivo,
    }),
  })
}

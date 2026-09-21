import { v4 as uuidv4 } from 'uuid'
import type { MovimientoInventario } from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato API v2 §9 (HU-025, HU-026). ENTRADA es de ambos roles; MERMA y
// AJUSTE_MANUAL exigen ADMIN (el backend responde 403 PERMISO_INSUFICIENTE si no).

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

export function registrarMerma(
  productoId: string,
  cantidad: number,
  motivo: string,
): Promise<MovimientoInventario> {
  return peticion<MovimientoInventario>('/inventario/movimientos/', {
    method: 'POST',
    body: JSON.stringify({
      operation_id: uuidv4(),
      producto_id: productoId,
      tipo: 'MERMA',
      cantidad,
      motivo,
    }),
  })
}

export function registrarAjusteManual(
  productoId: string,
  sentido: 'SUMA' | 'RESTA',
  cantidad: number,
  motivo: string,
): Promise<MovimientoInventario> {
  return peticion<MovimientoInventario>('/inventario/movimientos/', {
    method: 'POST',
    body: JSON.stringify({
      operation_id: uuidv4(),
      producto_id: productoId,
      tipo: 'AJUSTE_MANUAL',
      sentido,
      cantidad,
      motivo,
    }),
  })
}

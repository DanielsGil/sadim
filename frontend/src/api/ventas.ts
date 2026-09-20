import { v4 as uuidv4 } from 'uuid'
import type { DetalleVenta, MedioPago, Venta } from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato API v2 §7 (HU-012..HU-019, HU-048). Todo el recurso: ADMIN y OPERADOR.

export interface FiltrosVentas {
  estado?: string
  mesaId?: string
}

export function listarVentas(filtros: FiltrosVentas = {}): Promise<Venta[]> {
  const parametros = new URLSearchParams()
  if (filtros.estado) parametros.set('estado', filtros.estado)
  if (filtros.mesaId) parametros.set('mesa', filtros.mesaId)
  const cadena = parametros.toString()
  return peticion<Venta[]>(`/ventas/${cadena ? `?${cadena}` : ''}`)
}

export interface ItemVentaRapida {
  producto_id: string
  cantidad: number
}

export function crearVentaRapida(medioPago: MedioPago, detalles: ItemVentaRapida[]): Promise<Venta> {
  return peticion<Venta>('/ventas/', {
    method: 'POST',
    body: JSON.stringify({
      operation_id: uuidv4(),
      tipo: 'RAPIDA',
      medio_pago: medioPago,
      detalles: detalles.map((detalle) => ({ operation_id: uuidv4(), ...detalle })),
    }),
  })
}

export function abrirSesion(mesaId: string): Promise<Venta> {
  return peticion<Venta>('/ventas/', {
    method: 'POST',
    body: JSON.stringify({ operation_id: uuidv4(), tipo: 'SESION_DINAMICA', mesa_id: mesaId }),
  })
}

export function agregarDetalle(ventaId: string, productoId: string, cantidad: number): Promise<DetalleVenta> {
  return peticion<DetalleVenta>(`/ventas/${ventaId}/detalles/`, {
    method: 'POST',
    body: JSON.stringify({ operation_id: uuidv4(), producto_id: productoId, cantidad }),
  })
}

export function quitarDetalle(ventaId: string, detalleId: string): Promise<void> {
  return peticion<void>(`/ventas/${ventaId}/detalles/${detalleId}/`, {
    method: 'DELETE',
    body: JSON.stringify({ operation_id: uuidv4() }),
  })
}

export function cerrarVenta(ventaId: string, medioPago: MedioPago): Promise<Venta> {
  return peticion<Venta>(`/ventas/${ventaId}/cerrar/`, {
    method: 'PATCH',
    body: JSON.stringify({ operation_id: uuidv4(), medio_pago: medioPago }),
  })
}

export function cancelarVenta(ventaId: string): Promise<Venta> {
  return peticion<Venta>(`/ventas/${ventaId}/cancelar/`, {
    method: 'PATCH',
    body: JSON.stringify({ operation_id: uuidv4() }),
  })
}

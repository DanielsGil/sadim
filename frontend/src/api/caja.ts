import { v4 as uuidv4 } from 'uuid'
import type { MedioPago, MovimientoCaja, ResumenCaja } from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato API v2 §10 (HU-029, HU-050, HU-027). El histórico completo y el
// resumen son de ADMIN; registrar gasto, ver pendientes y confirmar son de
// ambos roles; anular es solo ADMIN (D15).

export interface FiltrosMovimientosCaja {
  fecha_desde?: string
  fecha_hasta?: string
  tipo?: string
}

export function listarMovimientosCaja(filtros: FiltrosMovimientosCaja = {}): Promise<MovimientoCaja[]> {
  const parametros = new URLSearchParams()
  if (filtros.fecha_desde) parametros.set('fecha_desde', filtros.fecha_desde)
  if (filtros.fecha_hasta) parametros.set('fecha_hasta', filtros.fecha_hasta)
  if (filtros.tipo) parametros.set('tipo', filtros.tipo)
  const cadena = parametros.toString()
  return peticion<MovimientoCaja[]>(`/movimientos-caja/${cadena ? `?${cadena}` : ''}`)
}

export function listarPendientes(): Promise<MovimientoCaja[]> {
  return peticion<MovimientoCaja[]>('/movimientos-caja/pendientes/')
}

export function registrarGasto(
  medioPago: MedioPago,
  valor: number,
  concepto: string,
): Promise<MovimientoCaja> {
  return peticion<MovimientoCaja>('/movimientos-caja/', {
    method: 'POST',
    body: JSON.stringify({
      operation_id: uuidv4(),
      tipo: 'GASTO',
      medio_pago: medioPago,
      valor,
      concepto,
    }),
  })
}

export function confirmarMovimiento(movimientoId: string): Promise<MovimientoCaja> {
  return peticion<MovimientoCaja>(`/movimientos-caja/${movimientoId}/confirmar/`, {
    method: 'PATCH',
    body: JSON.stringify({ operation_id: uuidv4() }),
  })
}

export function anularMovimiento(movimientoId: string, motivo: string): Promise<MovimientoCaja> {
  return peticion<MovimientoCaja>(`/movimientos-caja/${movimientoId}/anular/`, {
    method: 'PATCH',
    body: JSON.stringify({ operation_id: uuidv4(), motivo }),
  })
}

export function obtenerResumen(fecha: string): Promise<ResumenCaja> {
  return peticion<ResumenCaja>(`/movimientos-caja/resumen/?fecha=${fecha}`)
}

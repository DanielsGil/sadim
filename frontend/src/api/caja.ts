import { v4 as uuidv4 } from 'uuid'
import { guardarCopiaLectura, obtenerSesion } from '../db/baseLocal'
import type { MedioPago, MovimientoCaja, ResumenCaja } from '../tipos/dominio'
import { estaEnLinea } from '../sync/cacheCatalogo'
import { escribir } from '../sync/enrutador'
import { hayPendientesDe } from '../sync/pendientes'
import {
  CLAVE_COPIA_PENDIENTES_CAJA,
  gastoProvisional,
  listarPendientesCajaLocal,
  operationIdsMovimientosEnCola,
} from '../sync/vistaLocalInventarioCaja'
import { peticion } from './cliente'

// Contrato API v2 §10 (HU-029, HU-050, HU-027). El histórico completo y el
// resumen son de ADMIN; registrar gasto, ver pendientes y confirmar son de
// ambos roles; anular es solo ADMIN (D15). Registrar un gasto pasa por
// sync/enrutador (HU-030, D17); confirmar, anular, el histórico y el resumen
// requieren conexión (E-01 a E-05, D15).

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

export async function listarPendientes(): Promise<MovimientoCaja[]> {
  if (await hayPendientesDe('movimientos-caja')) {
    const local = await listarPendientesCajaLocal()
    if (local.length > 0) return local
  }
  try {
    const pendientes = await peticion<MovimientoCaja[]>('/movimientos-caja/pendientes/')
    await guardarCopiaLectura(CLAVE_COPIA_PENDIENTES_CAJA, pendientes)
    return pendientes
  } catch (error) {
    if (estaEnLinea()) throw error
    return listarPendientesCajaLocal()
  }
}

/** operation_id de los gastos que todavía están en la cola: el servidor aún no los conoce. */
export function operationIdsSinSincronizar(): Promise<Set<string>> {
  return operationIdsMovimientosEnCola()
}

export function registrarGasto(
  medioPago: MedioPago,
  valor: number,
  concepto: string,
): Promise<MovimientoCaja> {
  const idMovimiento = uuidv4()
  return escribir<MovimientoCaja>({
    resource: 'movimientos-caja',
    action: 'CREATE',
    idObjeto: idMovimiento,
    payload: { id: idMovimiento, tipo: 'GASTO', medio_pago: medioPago, valor, concepto },
    llamarEnLinea: (operationId) =>
      peticion<MovimientoCaja>('/movimientos-caja/', {
        method: 'POST',
        body: JSON.stringify({
          operation_id: operationId,
          tipo: 'GASTO',
          medio_pago: medioPago,
          valor,
          concepto,
        }),
      }),
    reflejarLocal: async (operationId) => {
      const sesion = await obtenerSesion()
      return gastoProvisional(
        {
          operation_id: operationId,
          resource: 'movimientos-caja',
          action: 'CREATE',
          id: idMovimiento,
          datos: { medio_pago: medioPago, valor, concepto },
          creado_en: new Date().toISOString(),
        },
        sesion?.usuario_id ?? '',
      )
    },
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

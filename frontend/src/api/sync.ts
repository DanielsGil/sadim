import { obtenerOCrearDeviceId } from '../db/baseLocal'
import { ErrorEnvioLote } from '../sync/motor'
import type { OperacionCola, ResultadoOperacionSync } from '../tipos/dominio'
import { peticion } from './cliente'
import { ErrorApi } from './errorApi'

/** POST /api/sync/ (Contrato v2 §13, HU-032) con el X-Device-Id de este dispositivo. */
export async function enviarLoteSincronizacion(
  operaciones: OperacionCola[],
): Promise<{ results: ResultadoOperacionSync[] }> {
  const deviceId = await obtenerOCrearDeviceId()
  try {
    return await peticion<{ results: ResultadoOperacionSync[] }>('/sync/', {
      method: 'POST',
      headers: { 'X-Device-Id': deviceId },
      body: JSON.stringify({
        operations: operaciones.map((op) => ({
          operation_id: op.operation_id,
          resource: op.resource,
          action: op.action,
          fecha_cliente: op.fecha_cliente,
          payload: op.payload,
        })),
      }),
    })
  } catch (error) {
    if (error instanceof ErrorApi) {
      if (error.code === 'DISPOSITIVO_NO_AUTORIZADO') {
        throw new ErrorEnvioLote(403, error.code, error.message)
      }
      if (error.code === 'SESION_EXPIRADA' || error.code === 'NO_AUTENTICADO') {
        throw new ErrorEnvioLote(401, error.code, error.message)
      }
      throw new ErrorEnvioLote(400, error.code, error.message)
    }
    throw error
  }
}

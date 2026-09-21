import { baseLocal } from '../db/baseLocal'

/**
 * true si la cola de sincronización tiene operaciones de alguno de estos
 * recursos (o de sus sub-recursos: 'ordenes-trabajo' cubre 'ordenes-trabajo.estado').
 * Las lecturas la usan para mostrar la vista local, y no la copia del
 * servidor, mientras esas operaciones no hayan llegado (HU-030, D22).
 */
export async function hayPendientesDe(...recursos: string[]): Promise<boolean> {
  const cola = await baseLocal.cola_sincronizacion.toArray()
  return cola.some((operacion) =>
    recursos.some((recurso) => operacion.resource === recurso || operacion.resource.startsWith(`${recurso}.`)),
  )
}

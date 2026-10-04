import { baseLocal } from '../db/baseLocal'
import type { Novedad, OperacionCola } from '../tipos/dominio'
import type { AlmacenCola, AlmacenNovedades, NovedadLocal } from './motor'

/** Implementación real de AlmacenCola sobre Dexie (ERD §10, almacén cola_sincronizacion). */
export const almacenColaDexie: AlmacenCola = {
  async listarOrdenadas() {
    return baseLocal.cola_sincronizacion.orderBy('creado_en').toArray()
  },
  async agregar(operacion: OperacionCola) {
    await baseLocal.cola_sincronizacion.put(operacion)
  },
  async quitar(operationId: string) {
    await baseLocal.cola_sincronizacion.delete(operationId)
  },
  async incrementarIntentos(operationId: string) {
    const fila = await baseLocal.cola_sincronizacion.get(operationId)
    if (fila) {
      await baseLocal.cola_sincronizacion.put({ ...fila, intentos: fila.intentos + 1 })
    }
  },
}

/**
 * Fila del almacén `novedades` a partir del resultado de una sincronización.
 * B5 (F-11): guarda el estado REAL del servidor (RECHAZADA o CONFLICTO); antes
 * se fijaba siempre 'RECHAZADA'.
 */
export function filaNovedadLocal(novedad: NovedadLocal, ahora: Date = new Date()): Novedad {
  return {
    id: novedad.operation_id,
    operation_id: novedad.operation_id,
    dispositivo_id: null,
    usuario_id: '',
    recurso: novedad.resource,
    accion: '',
    estado: novedad.estado,
    codigo_conflicto: novedad.codigo_conflicto,
    mensaje: novedad.mensaje,
    objeto_id: null,
    fecha_cliente: novedad.fecha_cliente,
    fecha_procesamiento: ahora.toISOString(),
    atendida: novedad.atendida,
  }
}

/** Implementación real de AlmacenNovedades sobre Dexie (ERD §10, almacén novedades). */
export const almacenNovedadesDexie: AlmacenNovedades = {
  async agregar(novedad: NovedadLocal) {
    await baseLocal.novedades.put(filaNovedadLocal(novedad))
  },
}

export async function contarPendientesEnCola(): Promise<number> {
  return baseLocal.cola_sincronizacion.count()
}

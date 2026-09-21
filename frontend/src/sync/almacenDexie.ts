import { baseLocal } from '../db/baseLocal'
import type { OperacionCola } from '../tipos/dominio'
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

/** Implementación real de AlmacenNovedades sobre Dexie (ERD §10, almacén novedades). */
export const almacenNovedadesDexie: AlmacenNovedades = {
  async agregar(novedad: NovedadLocal) {
    await baseLocal.novedades.put({
      id: novedad.operation_id,
      operation_id: novedad.operation_id,
      dispositivo_id: null,
      usuario_id: '',
      recurso: novedad.resource,
      accion: '',
      estado: 'RECHAZADA',
      codigo_conflicto: novedad.codigo_conflicto,
      mensaje: novedad.mensaje,
      objeto_id: null,
      fecha_cliente: novedad.fecha_cliente,
      fecha_procesamiento: new Date().toISOString(),
      atendida: novedad.atendida,
    })
  },
}

export async function contarPendientesEnCola(): Promise<number> {
  return baseLocal.cola_sincronizacion.count()
}

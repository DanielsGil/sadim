import { almacenColaDexie } from '../sync/almacenDexie'
import { estaEnLinea } from '../sync/cacheCatalogo'
import { debeEscribirEnLinea } from '../sync/motor'
import { guardarVentasAbiertasLocal, leerMapaMesasLocal, type MapaMesas } from '../sync/vistaLocalMesas'
import type { Venta } from '../tipos/dominio'
import { peticion } from './cliente'
import { listarMesas } from './mesas'

export interface MapaMesasConOrigen extends MapaMesas {
  /** true si viene de la copia local (sin conexión o con cola pendiente, D22). */
  provisional: boolean
}

/**
 * B4 (F-1): datos del mapa de mesas. Usa la MISMA regla que el enrutador de
 * escrituras: con conexión y cola vacía, el servidor; si no, la vista local
 * (catálogo de mesas + meta.ventas_abiertas + operaciones aún en cola). Antes
 * `listarVentas` sin mesaId relanzaba el error sin conexión y el mapa no cargaba.
 */
export async function obtenerMapaMesas(): Promise<MapaMesasConOrigen> {
  if (!(await debeEscribirEnLinea(almacenColaDexie, estaEnLinea()))) {
    return { ...(await leerMapaMesasLocal()), provisional: true }
  }
  try {
    const [mesas, ventasAbiertas] = await Promise.all([
      listarMesas({ activa: true }),
      peticion<Venta[]>('/ventas/?estado=ABIERTA'),
    ])
    await guardarVentasAbiertasLocal(ventasAbiertas)
    return { mesas, ventasAbiertas, provisional: false }
  } catch (error) {
    if (estaEnLinea()) throw error
    return { ...(await leerMapaMesasLocal()), provisional: true }
  }
}

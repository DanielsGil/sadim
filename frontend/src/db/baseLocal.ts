import Dexie, { type Table } from 'dexie'
import type { Sesion } from '../tipos/dominio'

/**
 * Persistencia local con Dexie sobre IndexedDB (ERD D-09, ADR-003/004).
 *
 * Por ahora solo existe el almacén "meta" (ERD §10), que guarda la sesión
 * vigente. Los demás almacenes que describe el ERD (catalogo,
 * operaciones_locales, cola_sincronizacion, novedades) son para el trabajo
 * offline de Sprint 3+ y no se agregan todavía.
 */
interface FilaMeta {
  clave: string
  valor: unknown
}

class BaseLocalSadim extends Dexie {
  meta!: Table<FilaMeta, string>

  constructor() {
    super('sadim')
    this.version(1).stores({
      meta: 'clave',
    })
  }
}

export const baseLocal = new BaseLocalSadim()

const CLAVE_SESION = 'sesion'

/** Nunca localStorage: la sesión vive únicamente en IndexedDB vía Dexie. */
export async function guardarSesion(sesion: Sesion): Promise<void> {
  await baseLocal.meta.put({ clave: CLAVE_SESION, valor: sesion })
}

export async function obtenerSesion(): Promise<Sesion | undefined> {
  const fila = await baseLocal.meta.get(CLAVE_SESION)
  return fila?.valor as Sesion | undefined
}

export async function borrarSesion(): Promise<void> {
  await baseLocal.meta.delete(CLAVE_SESION)
}

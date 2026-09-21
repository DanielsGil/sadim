import { baseLocal } from '../db/baseLocal'

type RecursoCatalogo = 'categorias' | 'productos' | 'mesas'

/** Copia de lectura de Categoria/Producto/Mesa (ERD §10, almacén "catalogo"). */
export async function cachearCatalogo<T extends { id: string }>(
  recurso: RecursoCatalogo,
  items: T[],
): Promise<void> {
  await baseLocal.catalogo.bulkPut(items.map((item) => ({ recurso, id: item.id, datos: item })))
}

export async function leerCatalogoLocal<T>(recurso: RecursoCatalogo): Promise<T[]> {
  const filas = await baseLocal.catalogo.where('recurso').equals(recurso).toArray()
  return filas.map((fila) => fila.datos as T)
}

export async function leerUnoDelCatalogoLocal<T>(recurso: RecursoCatalogo, id: string): Promise<T | undefined> {
  const fila = await baseLocal.catalogo.get([recurso, id])
  return fila?.datos as T | undefined
}

/** Corrige un campo de una fila ya cacheada (p. ej. el estado de una mesa tras abrir/cerrar offline). */
export async function parchearCatalogoLocal<T extends object>(
  recurso: RecursoCatalogo,
  id: string,
  cambios: Partial<T>,
): Promise<void> {
  const fila = await baseLocal.catalogo.get([recurso, id])
  if (fila) {
    await baseLocal.catalogo.put({ ...fila, datos: { ...fila.datos, ...cambios } })
  }
}

/** true si `navigator.onLine` dice que sí; en un entorno sin `navigator` (pruebas) asume en línea. */
export function estaEnLinea(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

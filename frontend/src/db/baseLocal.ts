import Dexie, { type Table } from 'dexie'
import type { ConfiguracionModulo, ConfiguracionPago, Novedad, OperacionCola, Sesion } from '../tipos/dominio'

/**
 * Persistencia local con Dexie sobre IndexedDB (ERD D-09, ADR-003/004, §10).
 *
 * Almacenes (nombres y contenido exactos del ERD §10):
 * - meta: sesión, identificador del dispositivo, última sincronización y
 *   configuración de módulos/pagos.
 * - catalogo: copia de lectura de Categoria/Producto/Mesa, se refresca en
 *   cada reconciliación.
 * - operaciones_locales: ventas/detalles/órdenes/abonos/consumos/movimientos
 *   creados en este dispositivo, con la misma forma que la entidad
 *   transaccional (UUID y operation_id ya asignados).
 * - cola_sincronizacion: operaciones pendientes de envío, en orden de
 *   creación, con recurso/acción/contenido/intentos. Alimenta /api/sync/ y se
 *   depura con APLICADA/DUPLICADA (Bloque 5b).
 * - novedades: reflejo local de RECHAZADA/CONFLICTO (D-05), para poder
 *   avisar al usuario incluso sin volver a golpear el servidor.
 *
 * Version 2 solo AGREGA almacenes sobre la version 1: Dexie conserva "meta"
 * (y con ella la sesión guardada) sin necesidad de un upgrade() explícito.
 */
interface FilaMeta {
  clave: string
  valor: unknown
}

interface FilaCatalogo {
  recurso: 'categorias' | 'productos' | 'mesas'
  id: string
  datos: Record<string, unknown>
}

export interface FilaOperacionLocal {
  operation_id: string
  resource: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  /** UUID del objeto de negocio que esta fila representa (venta, detalle, orden...). */
  id: string
  /**
   * Para operaciones "hijas" (agregar/quitar detalle, cerrar, cancelar,
   * abonos, consumos...), el id del objeto padre (la venta o la orden), para
   * poder reconstruir la vista local completa sin volver a golpear el
   * servidor. Ausente en las operaciones que crean el objeto raíz.
   */
  referencia_id?: string
  datos: Record<string, unknown>
  creado_en: string
}

class BaseLocalSadim extends Dexie {
  meta!: Table<FilaMeta, string>
  catalogo!: Table<FilaCatalogo, [string, string]>
  operaciones_locales!: Table<FilaOperacionLocal, string>
  cola_sincronizacion!: Table<OperacionCola, string>
  novedades!: Table<Novedad & { atendida_local?: boolean }, string>

  constructor() {
    super('sadim')
    this.version(1).stores({
      meta: 'clave',
    })
    this.version(2).stores({
      meta: 'clave',
      catalogo: '[recurso+id], recurso',
      operaciones_locales: 'operation_id, resource, id, referencia_id',
      cola_sincronizacion: 'operation_id, creado_en',
      novedades: 'operation_id, atendida',
    })
  }
}

export const baseLocal = new BaseLocalSadim()

const CLAVE_SESION = 'sesion'
const CLAVE_DEVICE_ID = 'device_id'
const CLAVE_ULTIMA_SINCRONIZACION = 'ultima_sincronizacion'
const CLAVE_MODULOS = 'modulos'
// Misma clave que ya escribe sync/reconciliacion.ts al final de cada sincronización.
const CLAVE_PAGOS = 'configuracion_pagos'
const CLAVE_PROPIETARIO_COLA = 'propietario_cola'

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

/**
 * D-04: identificador de ESTE dispositivo, generado una sola vez y guardado
 * en meta. Se pierde solo si el usuario borra los datos del navegador (ERD
 * §10, "Consideraciones") — en ese caso hay que registrar el dispositivo de
 * nuevo con conexión.
 */
export async function obtenerOCrearDeviceId(): Promise<string> {
  const fila = await baseLocal.meta.get(CLAVE_DEVICE_ID)
  if (fila?.valor) return fila.valor as string
  const nuevo = crypto.randomUUID()
  await baseLocal.meta.put({ clave: CLAVE_DEVICE_ID, valor: nuevo })
  return nuevo
}

export async function guardarUltimaSincronizacion(fechaIso: string): Promise<void> {
  await baseLocal.meta.put({ clave: CLAVE_ULTIMA_SINCRONIZACION, valor: fechaIso })
}

export async function obtenerUltimaSincronizacion(): Promise<string | undefined> {
  const fila = await baseLocal.meta.get(CLAVE_ULTIMA_SINCRONIZACION)
  return fila?.valor as string | undefined
}

export async function guardarModulosLocal(modulos: ConfiguracionModulo): Promise<void> {
  await baseLocal.meta.put({ clave: CLAVE_MODULOS, valor: modulos })
}

export async function obtenerModulosLocal(): Promise<ConfiguracionModulo | undefined> {
  const fila = await baseLocal.meta.get(CLAVE_MODULOS)
  return fila?.valor as ConfiguracionModulo | undefined
}

export async function guardarConfiguracionPagosLocal(pagos: ConfiguracionPago): Promise<void> {
  await baseLocal.meta.put({ clave: CLAVE_PAGOS, valor: pagos })
}

export async function obtenerConfiguracionPagosLocal(): Promise<ConfiguracionPago | undefined> {
  const fila = await baseLocal.meta.get(CLAVE_PAGOS)
  return fila?.valor as ConfiguracionPago | undefined
}

/**
 * Copia de LECTURA de lo último que el servidor devolvió (listado de órdenes,
 * detalle de una orden, stock, etc.), para mostrarlo sin conexión (HU-030,
 * ERD §10). Solo sirve para mostrar: se reemplaza cada vez que la misma
 * consulta se hace en línea y nunca se envía al servidor (D22).
 */
export async function guardarCopiaLectura(clave: string, valor: unknown): Promise<void> {
  await baseLocal.meta.put({ clave: `copia:${clave}`, valor })
}

export async function leerCopiaLectura<T>(clave: string): Promise<T | undefined> {
  const fila = await baseLocal.meta.get(`copia:${clave}`)
  return fila?.valor as T | undefined
}

/**
 * D21: dueño de las operaciones que hoy tiene la cola_sincronizacion. Se fija
 * al encolar la primera operación pendiente y se limpia cuando la cola queda
 * vacía; mientras exista, ni se puede cerrar sesión ni loguear con otro
 * usuario (solo el mismo puede continuar si el token venció offline, D23).
 */
export async function guardarPropietarioColaSiFalta(usuarioId: string): Promise<void> {
  const actual = await baseLocal.meta.get(CLAVE_PROPIETARIO_COLA)
  if (!actual) await baseLocal.meta.put({ clave: CLAVE_PROPIETARIO_COLA, valor: usuarioId })
}

export async function obtenerPropietarioCola(): Promise<string | undefined> {
  const fila = await baseLocal.meta.get(CLAVE_PROPIETARIO_COLA)
  return fila?.valor as string | undefined
}

export async function borrarPropietarioCola(): Promise<void> {
  await baseLocal.meta.delete(CLAVE_PROPIETARIO_COLA)
}

/**
 * E-19: bandeja de selección guardada en el dispositivo, una por mesa
 * (`mesa:<id>`) y una para la venta rápida (`venta-rapida`), para que el
 * botón «atrás» o cerrar la app no la pierdan. Vive en "meta" (sin cambiar
 * el schema de Dexie) y nunca se envía al servidor por sí sola.
 */
const PREFIJO_BANDEJA = 'bandeja:'

export async function guardarBandejaLocal(clave: string, items: unknown[]): Promise<void> {
  if (items.length === 0) {
    await baseLocal.meta.delete(`${PREFIJO_BANDEJA}${clave}`)
    return
  }
  await baseLocal.meta.put({ clave: `${PREFIJO_BANDEJA}${clave}`, valor: items })
}

export async function obtenerBandejaLocal<T>(clave: string): Promise<T[]> {
  const fila = await baseLocal.meta.get(`${PREFIJO_BANDEJA}${clave}`)
  return (fila?.valor as T[] | undefined) ?? []
}

/** Al cerrar sesión se borran todas las bandejas (no la cola ni la copia local). */
export async function borrarBandejasLocales(): Promise<void> {
  await baseLocal.meta.where('clave').startsWith(PREFIJO_BANDEJA).delete()
}

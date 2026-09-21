import { v4 as uuidv4 } from 'uuid'
import { enviarLoteSincronizacion } from '../api/sync'
import { baseLocal, borrarPropietarioCola, guardarPropietarioColaSiFalta, obtenerSesion } from '../db/baseLocal'
import type { AccionSincronizable, OperacionCola, RecursoSincronizable } from '../tipos/dominio'
import { almacenColaDexie, almacenNovedadesDexie } from './almacenDexie'
import { estaEnLinea } from './cacheCatalogo'
import { debeEscribirEnLinea, sincronizar } from './motor'
import { reconciliar } from './reconciliacion'

interface OpcionesEscritura<T> {
  resource: RecursoSincronizable
  action: AccionSincronizable
  /** Payload con la forma que espera /api/sync/ (D17): incluye `id`/`venta_id`/etc. */
  payload: Record<string, unknown>
  operationId?: string
  /** id UUID del objeto raíz que esta operación crea o afecta (venta, orden...). */
  idObjeto: string
  /** Para operaciones hijas (detalle, cerrar, abono...): id del objeto padre. */
  referenciaId?: string
  llamarEnLinea: (operationId: string) => Promise<T>
  /** Construye la respuesta "provisional" (D22) que se muestra sin conexión. */
  reflejarLocal: (operationId: string) => T | Promise<T>
}

/**
 * Punto único de escritura para los recursos sincronizables (D17, HU-030).
 * Con conexión Y cola vacía, llama al endpoint en línea de siempre. Si no,
 * encola la operación en orden (ERD §10) y refleja el efecto localmente como
 * "provisional" (D22): nunca se envía ese valor calculado al servidor, que
 * vuelve a calcular todo al sincronizar.
 */
export async function escribir<T>(opciones: OpcionesEscritura<T>): Promise<T> {
  const operationId = opciones.operationId ?? uuidv4()
  const enLinea = await debeEscribirEnLinea(almacenColaDexie, estaEnLinea())

  if (enLinea) {
    try {
      return await opciones.llamarEnLinea(operationId)
    } catch (error) {
      if (estaEnLinea()) throw error
      // Se creía en línea y la petición falló por conectividad real: se
      // degrada a encolar en vez de perder la operación.
    }
  }

  const operacion: OperacionCola = {
    operation_id: operationId,
    resource: opciones.resource,
    action: opciones.action,
    fecha_cliente: new Date().toISOString(),
    payload: opciones.payload,
    creado_en: new Date().toISOString(),
    intentos: 0,
  }
  await almacenColaDexie.agregar(operacion)
  const sesion = await obtenerSesion()
  if (sesion) await guardarPropietarioColaSiFalta(sesion.usuario_id)
  await baseLocal.operaciones_locales.put({
    operation_id: operationId,
    resource: opciones.resource,
    action: opciones.action,
    id: opciones.idObjeto,
    referencia_id: opciones.referenciaId,
    datos: opciones.payload,
    creado_en: operacion.creado_en,
  })

  void dispararSincronizacion()
  return await opciones.reflejarLocal(operationId)
}

/** Se dispara al recuperar conexión, al abrir la app y periódicamente mientras haya cola. */
export async function dispararSincronizacion(): Promise<void> {
  if (!estaEnLinea()) return
  await sincronizar({
    cola: almacenColaDexie,
    novedades: almacenNovedadesDexie,
    enviarLote: enviarLoteSincronizacion,
    estaEnLinea,
    reconciliar,
  })
  if ((await contarOperacionesPendientes()) === 0) await borrarPropietarioCola()
}

export async function contarOperacionesPendientes(): Promise<number> {
  return baseLocal.cola_sincronizacion.count()
}

import type { OperacionCola, ResultadoOperacionSync } from '../tipos/dominio'

/**
 * Motor de sincronización (HU-032, lado cliente) y regla de ruteo de
 * escritura (HU-030/HU-046, D16-D21, ERD §8-§10).
 *
 * Todo lo de este módulo recibe sus dependencias por parámetro (en vez de
 * importar Dexie/fetch directamente) para poder probarlo con Vitest usando
 * un almacén en memoria, sin necesitar un IndexedDB real (`src/sync/almacenDexie.ts`
 * trae la implementación real sobre Dexie que usa la app).
 */

export const MAXIMO_OPERACIONES_POR_LOTE = 200
/** ERD §10: "advertir al usuario cuando el número de operaciones pendientes sea elevado". */
export const UMBRAL_ADVERTENCIA_COLA = 100

export interface AlmacenCola {
  /** En orden de creación (D17/ERD §10): así se envían en el mismo orden. */
  listarOrdenadas(): Promise<OperacionCola[]>
  agregar(operacion: OperacionCola): Promise<void>
  quitar(operationId: string): Promise<void>
  incrementarIntentos(operationId: string): Promise<void>
}

export interface NovedadLocal {
  operation_id: string
  resource: string
  /** B5 (F-11): el estado real que devolvió el servidor. */
  estado: 'RECHAZADA' | 'CONFLICTO'
  codigo_conflicto: string | null
  mensaje: string | null
  fecha_cliente: string
  atendida: boolean
}

export interface AlmacenNovedades {
  agregar(novedad: NovedadLocal): Promise<void>
}

/** Error que debe lanzar `enviarLote` ante una respuesta no-2xx, para que el motor decida qué hacer. */
export class ErrorEnvioLote extends Error {
  status: number
  code?: string
  constructor(status: number, code?: string, message?: string) {
    super(message ?? `Error HTTP ${status}`)
    this.status = status
    this.code = code
  }
}

export interface DependenciasMotor {
  cola: AlmacenCola
  novedades: AlmacenNovedades
  /** Llama a POST /api/sync/ con X-Device-Id; lanza ErrorEnvioLote si la respuesta no es 2xx. */
  enviarLote(operaciones: OperacionCola[]): Promise<{ results: ResultadoOperacionSync[] }>
  estaEnLinea(): boolean
  /** Se invoca ante 403 DISPOSITIVO_NO_AUTORIZADO: la cola se conserva intacta. */
  avisarDispositivoNoAutorizado?(): void
  /** Se invoca ante 401: la cola se conserva y se debe pedir login antes de seguir. */
  avisarRequiereLogin?(): void
  /** Se invoca tras un lote enviado con éxito, para refrescar catálogo/stock/mesas/etc. */
  reconciliar?(): Promise<void>
}

let sincronizando = false

/** Nunca corren dos sincronizaciones a la vez (requisito explícito del Bloque 5b). */
export function estaSincronizando(): boolean {
  return sincronizando
}

/**
 * Envía la cola en lotes de hasta `MAXIMO_OPERACIONES_POR_LOTE`, en el orden
 * en que se crearon. Por cada resultado: APLICADA/DUPLICADA se depuran de la
 * cola; RECHAZADA/CONFLICTO se depuran de la cola y pasan a "novedades".
 *
 * Ante 403 DISPOSITIVO_NO_AUTORIZADO o 401, la cola se conserva intacta (ni
 * se depura ni se reintenta ese lote) y se avisa; ante cualquier otro error
 * de red (sin conexión real, servidor caído) también se conserva la cola y
 * se corta sin lanzar, para que el llamador pueda reintentar más tarde.
 */
export async function sincronizar(deps: DependenciasMotor): Promise<void> {
  if (sincronizando) return
  if (!deps.estaEnLinea()) return

  sincronizando = true
  try {
    const pendientes = await deps.cola.listarOrdenadas()
    if (pendientes.length === 0) return

    for (let inicio = 0; inicio < pendientes.length; inicio += MAXIMO_OPERACIONES_POR_LOTE) {
      const lote = pendientes.slice(inicio, inicio + MAXIMO_OPERACIONES_POR_LOTE)

      let respuesta: { results: ResultadoOperacionSync[] }
      try {
        respuesta = await deps.enviarLote(lote)
      } catch (error) {
        if (error instanceof ErrorEnvioLote) {
          if (error.status === 403 && error.code === 'DISPOSITIVO_NO_AUTORIZADO') {
            deps.avisarDispositivoNoAutorizado?.()
            return
          }
          if (error.status === 401) {
            deps.avisarRequiereLogin?.()
            return
          }
          // Marca el intento y sigue conservando la cola; no se propaga: es
          // una falla transitoria del lote, no un error de programación.
          for (const operacion of lote) {
            await deps.cola.incrementarIntentos(operacion.operation_id)
          }
          return
        }
        // Error de red (sin conexión real pese a navigator.onLine, DNS,
        // etc.): igual se conserva la cola y se corta sin propagar.
        return
      }

      for (const resultado of respuesta.results) {
        const operacionOriginal = lote.find((op) => op.operation_id === resultado.operation_id)
        if (resultado.estado === 'APLICADA' || resultado.estado === 'DUPLICADA') {
          await deps.cola.quitar(resultado.operation_id)
          continue
        }
        // RECHAZADA o CONFLICTO
        await deps.cola.quitar(resultado.operation_id)
        await deps.novedades.agregar({
          operation_id: resultado.operation_id,
          resource: operacionOriginal?.resource ?? 'desconocido',
          estado: resultado.estado,
          codigo_conflicto: resultado.codigo_conflicto ?? null,
          mensaje: resultado.mensaje ?? null,
          fecha_cliente: operacionOriginal?.fecha_cliente ?? new Date().toISOString(),
          atendida: false,
        })
      }
    }

    await deps.reconciliar?.()
  } finally {
    sincronizando = false
  }
}

/** Solo para pruebas: resetea el candado de "una sincronización a la vez". */
export function _resetearCandadoSincronizacion(): void {
  sincronizando = false
}

// ---------------------------------------------------------------------------
// Regla de ruteo de escritura (HU-030/HU-046): con conexión y cola vacía,
// llamar en línea; si no, encolar. D21 (cerrar sesión/cambiar de usuario con
// cola pendiente) se resuelve preguntando `contarPendientes(...) === 0` desde
// SesionContext, no aquí.
// ---------------------------------------------------------------------------

export async function debeEscribirEnLinea(cola: AlmacenCola, enLinea: boolean): Promise<boolean> {
  if (!enLinea) return false
  const pendientes = await cola.listarOrdenadas()
  return pendientes.length === 0
}

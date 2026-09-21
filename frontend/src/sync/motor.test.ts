import { beforeEach, describe, expect, it } from 'vitest'
import type { OperacionCola, ResultadoOperacionSync } from '../tipos/dominio'
import {
  _resetearCandadoSincronizacion,
  debeEscribirEnLinea,
  ErrorEnvioLote,
  sincronizar,
  type AlmacenCola,
  type AlmacenNovedades,
  type NovedadLocal,
} from './motor'

/** Almacenes en memoria: prueban la lógica del motor sin IndexedDB real. */
function crearAlmacenColaEnMemoria(operaciones: OperacionCola[] = []): AlmacenCola & { filas: OperacionCola[] } {
  const filas = [...operaciones]
  return {
    filas,
    async listarOrdenadas() {
      return [...filas].sort((a, b) => a.creado_en.localeCompare(b.creado_en))
    },
    async agregar(operacion) {
      filas.push(operacion)
    },
    async quitar(operationId) {
      const indice = filas.findIndex((op) => op.operation_id === operationId)
      if (indice >= 0) filas.splice(indice, 1)
    },
    async incrementarIntentos(operationId) {
      const fila = filas.find((op) => op.operation_id === operationId)
      if (fila) fila.intentos += 1
    },
  }
}

function crearAlmacenNovedadesEnMemoria(): AlmacenNovedades & { filas: NovedadLocal[] } {
  const filas: NovedadLocal[] = []
  return {
    filas,
    async agregar(novedad) {
      filas.push(novedad)
    },
  }
}

function operacion(operationId: string, creadoEn: string, resource = 'ventas'): OperacionCola {
  return {
    operation_id: operationId,
    resource: resource as OperacionCola['resource'],
    action: 'CREATE',
    fecha_cliente: creadoEn,
    payload: {},
    creado_en: creadoEn,
    intentos: 0,
  }
}

beforeEach(() => {
  _resetearCandadoSincronizacion()
})

describe('sincronizar', () => {
  it('envía las operaciones en el orden en que se crearon', async () => {
    const cola = crearAlmacenColaEnMemoria([
      operacion('op-2', '2026-01-01T10:02:00Z'),
      operacion('op-1', '2026-01-01T10:01:00Z'),
      operacion('op-3', '2026-01-01T10:03:00Z'),
    ])
    const novedades = crearAlmacenNovedadesEnMemoria()
    const ordenEnviado: string[] = []

    await sincronizar({
      cola,
      novedades,
      estaEnLinea: () => true,
      enviarLote: async (lote) => {
        ordenEnviado.push(...lote.map((op) => op.operation_id))
        return { results: lote.map((op) => ({ operation_id: op.operation_id, estado: 'APLICADA', objeto_id: null })) }
      },
    })

    expect(ordenEnviado).toEqual(['op-1', 'op-2', 'op-3'])
  })

  it('depura APLICADA y DUPLICADA de la cola, y manda RECHAZADA/CONFLICTO a novedades', async () => {
    const cola = crearAlmacenColaEnMemoria([
      operacion('op-aplicada', '2026-01-01T10:00:00Z'),
      operacion('op-duplicada', '2026-01-01T10:00:01Z'),
      operacion('op-rechazada', '2026-01-01T10:00:02Z'),
      operacion('op-conflicto', '2026-01-01T10:00:03Z'),
    ])
    const novedades = crearAlmacenNovedadesEnMemoria()

    const resultados: ResultadoOperacionSync[] = [
      { operation_id: 'op-aplicada', estado: 'APLICADA', objeto_id: 'x' },
      { operation_id: 'op-duplicada', estado: 'DUPLICADA', objeto_id: 'x', estado_original: 'APLICADA' },
      {
        operation_id: 'op-rechazada',
        estado: 'RECHAZADA',
        objeto_id: null,
        codigo_conflicto: 'DATOS_INVALIDOS',
        mensaje: 'dato inválido',
      },
      {
        operation_id: 'op-conflicto',
        estado: 'CONFLICTO',
        objeto_id: 'y',
        codigo_conflicto: 'STOCK_INSUFICIENTE',
        mensaje: 'sin existencias',
      },
    ]

    await sincronizar({
      cola,
      novedades,
      estaEnLinea: () => true,
      enviarLote: async () => ({ results: resultados }),
    })

    expect(cola.filas).toHaveLength(0)
    expect(novedades.filas.map((n) => n.operation_id).sort()).toEqual(['op-conflicto', 'op-rechazada'])
    expect(novedades.filas.find((n) => n.operation_id === 'op-conflicto')?.codigo_conflicto).toBe(
      'STOCK_INSUFICIENTE',
    )
  })

  it('conserva la cola intacta ante 403 DISPOSITIVO_NO_AUTORIZADO y avisa', async () => {
    const cola = crearAlmacenColaEnMemoria([operacion('op-1', '2026-01-01T10:00:00Z')])
    const novedades = crearAlmacenNovedadesEnMemoria()
    let avisado = false

    await sincronizar({
      cola,
      novedades,
      estaEnLinea: () => true,
      enviarLote: async () => {
        throw new ErrorEnvioLote(403, 'DISPOSITIVO_NO_AUTORIZADO', 'no autorizado')
      },
      avisarDispositivoNoAutorizado: () => {
        avisado = true
      },
    })

    expect(cola.filas).toHaveLength(1)
    expect(cola.filas[0].operation_id).toBe('op-1')
    expect(novedades.filas).toHaveLength(0)
    expect(avisado).toBe(true)
  })

  it('conserva la cola intacta ante 401 y pide iniciar sesión', async () => {
    const cola = crearAlmacenColaEnMemoria([operacion('op-1', '2026-01-01T10:00:00Z')])
    const novedades = crearAlmacenNovedadesEnMemoria()
    let pidioLogin = false

    await sincronizar({
      cola,
      novedades,
      estaEnLinea: () => true,
      enviarLote: async () => {
        throw new ErrorEnvioLote(401, 'SESION_EXPIRADA', 'sesión vencida')
      },
      avisarRequiereLogin: () => {
        pidioLogin = true
      },
    })

    expect(cola.filas).toHaveLength(1)
    expect(pidioLogin).toBe(true)
  })

  it('no sincroniza si no hay conexión', async () => {
    const cola = crearAlmacenColaEnMemoria([operacion('op-1', '2026-01-01T10:00:00Z')])
    const novedades = crearAlmacenNovedadesEnMemoria()
    let seLlamo = false

    await sincronizar({
      cola,
      novedades,
      estaEnLinea: () => false,
      enviarLote: async () => {
        seLlamo = true
        return { results: [] }
      },
    })

    expect(seLlamo).toBe(false)
    expect(cola.filas).toHaveLength(1)
  })
})

describe('debeEscribirEnLinea (regla de ruteo)', () => {
  it('sin conexión, siempre encola', async () => {
    const cola = crearAlmacenColaEnMemoria()
    expect(await debeEscribirEnLinea(cola, false)).toBe(false)
  })

  it('con conexión y cola vacía, escribe en línea', async () => {
    const cola = crearAlmacenColaEnMemoria()
    expect(await debeEscribirEnLinea(cola, true)).toBe(true)
  })

  it('con conexión pero cola no vacía, encola igual (preserva el orden)', async () => {
    const cola = crearAlmacenColaEnMemoria([operacion('op-1', '2026-01-01T10:00:00Z')])
    expect(await debeEscribirEnLinea(cola, true)).toBe(false)
  })
})

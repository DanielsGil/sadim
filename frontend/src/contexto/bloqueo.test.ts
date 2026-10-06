import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorApi } from '../api/errorApi'
import {
  ESPERA_BASE_MS,
  INTENTOS_SIN_ESPERA,
  SIN_INTENTOS,
  esperaTrasFallos,
  intentarDesbloqueo,
  renovarVerificador,
  type AlmacenBloqueo,
  type DependenciasDesbloqueo,
  type EstadoIntentos,
} from './bloqueo'
import { TemporizadorInactividad } from './inactividad'
import { ITERACIONES_PBKDF2, crearVerificador, type VerificadorLocal } from './verificadorLocal'

const SESION = { usuario_id: 'u-maria', username: 'maria' }
const CLAVE = 'Cafe-Aroma-2026'
// Las pruebas derivan con pocas iteraciones para ir rápido; la app usa ITERACIONES_PBKDF2.
const ITERACIONES_PRUEBA = 1000

/**
 * "Dispositivo" en memoria: el `meta` de Dexie con la cola, una bandeja y una
 * copia local, más los intentos y el verificador que maneja el bloqueo.
 */
function crearDispositivo() {
  const meta = new Map<string, unknown>([
    ['bandeja:mesa:3', [{ producto_id: 'p1', cantidad: 2 }]],
    ['copia:ordenes', [{ id: 'o1' }]],
  ])
  const cola = [
    { operation_id: 'op-1', resource: 'ventas', action: 'CREATE' },
    { operation_id: 'op-2', resource: 'ventas.detalles', action: 'CREATE' },
  ]
  const almacen: AlmacenBloqueo = {
    leerIntentos: async () => (meta.get('intentos_desbloqueo') as EstadoIntentos | undefined) ?? SIN_INTENTOS,
    guardarIntentos: async (estado) => void meta.set('intentos_desbloqueo', estado),
    leerVerificador: async () => meta.get('verificador_local') as VerificadorLocal | undefined,
    guardarVerificador: async (verificador) => void meta.set('verificador_local', verificador),
  }
  return { meta, cola, almacen }
}

function dependencias(
  almacen: AlmacenBloqueo,
  opciones: { servidor: boolean; login?: DependenciasDesbloqueo['loginServidor']; ahora?: () => number },
): DependenciasDesbloqueo {
  return {
    almacen,
    servidorDisponible: async () => opciones.servidor,
    loginServidor: opciones.login ?? (async () => undefined),
    ahora: opciones.ahora ?? (() => Date.now()),
    iteraciones: ITERACIONES_PRUEBA,
  }
}

describe('D30: verificador local (PBKDF2-SHA256)', () => {
  it('usa 600.000 iteraciones por defecto y nunca guarda la contraseña', async () => {
    expect(ITERACIONES_PBKDF2).toBe(600_000)
    const verificador = await crearVerificador(CLAVE, SESION.usuario_id, SESION.username, ITERACIONES_PRUEBA)
    expect(JSON.stringify(verificador)).not.toContain(CLAVE)
    expect(verificador.sal).not.toBe('')
    expect(verificador.derivacion).not.toBe('')
  })
})

describe('D30: desbloqueo sin conexión', () => {
  it('con la contraseña correcta se desbloquea contra el verificador local', async () => {
    const { almacen } = crearDispositivo()
    await renovarVerificador(almacen, CLAVE, SESION.usuario_id, SESION.username, ITERACIONES_PRUEBA)

    const resultado = await intentarDesbloqueo(SESION, CLAVE, dependencias(almacen, { servidor: false }))

    expect(resultado).toEqual({ tipo: 'DESBLOQUEADA', via: 'DISPOSITIVO' })
  })

  it('con la contraseña incorrecta no se desbloquea y cuenta el fallo', async () => {
    const { almacen } = crearDispositivo()
    await renovarVerificador(almacen, CLAVE, SESION.usuario_id, SESION.username, ITERACIONES_PRUEBA)

    const resultado = await intentarDesbloqueo(SESION, 'otra-clave', dependencias(almacen, { servidor: false }))

    expect(resultado).toEqual({ tipo: 'INCORRECTA', esperaMs: 0 })
    expect((await almacen.leerIntentos()).fallos).toBe(1)
  })

  it('sin verificador local (sesión de antes del cambio) explica que hace falta conexión', async () => {
    const { almacen } = crearDispositivo()
    const resultado = await intentarDesbloqueo(SESION, CLAVE, dependencias(almacen, { servidor: false }))
    expect(resultado).toEqual({ tipo: 'SIN_VERIFICADOR' })
  })

  it('con el servidor respondiendo valida SOLO con el servidor, aunque el verificador local coincida', async () => {
    const { almacen } = crearDispositivo()
    await renovarVerificador(almacen, CLAVE, SESION.usuario_id, SESION.username, ITERACIONES_PRUEBA)
    const login = vi.fn(async () => {
      throw new ErrorApi('CREDENCIALES_INVALIDAS', 'El usuario o la contraseña no son correctos.')
    })

    const resultado = await intentarDesbloqueo(SESION, CLAVE, dependencias(almacen, { servidor: true, login }))

    expect(login).toHaveBeenCalledWith('maria', CLAVE)
    expect(resultado.tipo).toBe('INCORRECTA')
    expect((await almacen.leerIntentos()).fallos).toBe(1)
  })

  it('un desbloqueo exitoso en línea renueva el verificador local', async () => {
    const { almacen } = crearDispositivo()
    const resultado = await intentarDesbloqueo(SESION, CLAVE, dependencias(almacen, { servidor: true }))

    expect(resultado).toEqual({ tipo: 'DESBLOQUEADA', via: 'SERVIDOR' })
    const sinConexion = await intentarDesbloqueo(SESION, CLAVE, dependencias(almacen, { servidor: false }))
    expect(sinConexion).toEqual({ tipo: 'DESBLOQUEADA', via: 'DISPOSITIVO' })
  })
})

describe('D30: espera progresiva tras 5 fallos seguidos', () => {
  it('los primeros 4 fallos no esperan; el 5.º impone 30 s y luego crece', () => {
    expect(INTENTOS_SIN_ESPERA).toBe(5)
    expect(esperaTrasFallos(4)).toBe(0)
    expect(esperaTrasFallos(5)).toBe(ESPERA_BASE_MS)
    expect(esperaTrasFallos(6)).toBe(2 * ESPERA_BASE_MS)
  })

  it('tras 5 fallos rechaza incluso la contraseña correcta hasta que pase la espera', async () => {
    const { almacen } = crearDispositivo()
    await renovarVerificador(almacen, CLAVE, SESION.usuario_id, SESION.username, ITERACIONES_PRUEBA)
    let ahora = 1_000_000
    const deps = dependencias(almacen, { servidor: false, ahora: () => ahora })

    for (let i = 1; i < INTENTOS_SIN_ESPERA; i += 1) {
      expect(await intentarDesbloqueo(SESION, 'mal', deps)).toEqual({ tipo: 'INCORRECTA', esperaMs: 0 })
    }
    expect(await intentarDesbloqueo(SESION, 'mal', deps)).toEqual({ tipo: 'INCORRECTA', esperaMs: ESPERA_BASE_MS })

    ahora += 10 * 1000
    expect(await intentarDesbloqueo(SESION, CLAVE, deps)).toEqual({
      tipo: 'ESPERA',
      esperaMs: ESPERA_BASE_MS - 10 * 1000,
    })

    ahora += ESPERA_BASE_MS
    expect(await intentarDesbloqueo(SESION, CLAVE, deps)).toEqual({ tipo: 'DESBLOQUEADA', via: 'DISPOSITIVO' })
    expect(await almacen.leerIntentos()).toEqual(SIN_INTENTOS)
  })
})

describe('D30: bloquear no toca la cola', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('bloquear y los intentos de desbloqueo dejan intactas la cola, las bandejas y la copia local', async () => {
    const { meta, cola, almacen } = crearDispositivo()
    const colaAntes = structuredClone(cola)
    const bandejaAntes = structuredClone(meta.get('bandeja:mesa:3'))
    const copiaAntes = structuredClone(meta.get('copia:ordenes'))
    const temporizador = new TemporizadorInactividad({
      bloquear: () => void meta.set('sesion_bloqueada', true),
      alCambiarEstado: () => undefined,
    })

    temporizador.iniciar()
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000)
    expect(meta.get('sesion_bloqueada')).toBe(true)

    vi.useRealTimers()
    await renovarVerificador(almacen, CLAVE, SESION.usuario_id, SESION.username, ITERACIONES_PRUEBA)
    await intentarDesbloqueo(SESION, 'mal', dependencias(almacen, { servidor: false }))
    await intentarDesbloqueo(SESION, CLAVE, dependencias(almacen, { servidor: false }))

    expect(cola).toEqual(colaAntes)
    expect(meta.get('bandeja:mesa:3')).toEqual(bandejaAntes)
    expect(meta.get('copia:ordenes')).toEqual(copiaAntes)
    expect([...meta.keys()].sort()).toEqual(
      ['bandeja:mesa:3', 'copia:ordenes', 'intentos_desbloqueo', 'sesion_bloqueada', 'verificador_local'].sort(),
    )
  })
})

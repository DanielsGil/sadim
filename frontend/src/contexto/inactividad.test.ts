import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemporizadorInactividad, type EstadoInactividad } from './inactividad'

const MINUTO = 60 * 1000
const LIMITE = 30 * MINUTO

function crear(estadoRed: { enLinea: boolean; pendientes: number }) {
  const estados: EstadoInactividad[] = []
  const cerrar = vi.fn()
  const temporizador = new TemporizadorInactividad({
    limiteMs: LIMITE,
    avisoMs: MINUTO,
    reintentoMs: 15 * 1000,
    puedeCerrar: async () => estadoRed.enLinea && estadoRed.pendientes === 0,
    cerrar,
    alCambiarEstado: (estado) => estados.push(estado),
  })
  return { temporizador, cerrar, estados }
}

describe('D27: cierre de sesión por inactividad', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('cierra la sesión a los 30 minutos sin actividad, con aviso un minuto antes', async () => {
    const { temporizador, cerrar, estados } = crear({ enLinea: true, pendientes: 0 })
    temporizador.iniciar()

    await vi.advanceTimersByTimeAsync(29 * MINUTO)
    expect(estados).toEqual(['AVISO'])
    expect(cerrar).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(MINUTO)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('la actividad reinicia la cuenta y cancela el aviso', async () => {
    const { temporizador, cerrar, estados } = crear({ enLinea: true, pendientes: 0 })
    temporizador.iniciar()

    await vi.advanceTimersByTimeAsync(29 * MINUTO + 30 * 1000)
    expect(temporizador.estadoActual).toBe('AVISO')

    temporizador.registrarActividad()
    expect(estados).toEqual(['AVISO', 'ACTIVA'])

    // 30 minutos desde el ÚLTIMO toque, no desde el inicio.
    await vi.advanceTimersByTimeAsync(29 * MINUTO)
    expect(cerrar).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(MINUTO)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('no cierra la sesión con cola pendiente; avisa y cierra cuando la cola queda vacía', async () => {
    const red = { enLinea: true, pendientes: 3 }
    const { temporizador, cerrar } = crear(red)
    temporizador.iniciar()

    await vi.advanceTimersByTimeAsync(LIMITE)
    expect(cerrar).not.toHaveBeenCalled()
    expect(temporizador.estadoActual).toBe('EXPIRADA_PENDIENTE')

    // La actividad no revive una sesión ya expirada, y sigue sin cerrar mientras haya cola.
    temporizador.registrarActividad()
    await vi.advanceTimersByTimeAsync(5 * MINUTO)
    expect(cerrar).not.toHaveBeenCalled()

    red.pendientes = 0
    await vi.advanceTimersByTimeAsync(15 * 1000)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('no cierra la sesión sin conexión aunque la cola esté vacía', async () => {
    const red = { enLinea: false, pendientes: 0 }
    const { temporizador, cerrar } = crear(red)
    temporizador.iniciar()

    await vi.advanceTimersByTimeAsync(LIMITE + 2 * MINUTO)
    expect(cerrar).not.toHaveBeenCalled()

    red.enLinea = true
    temporizador.reintentarAhora()
    await vi.advanceTimersByTimeAsync(0)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })
})

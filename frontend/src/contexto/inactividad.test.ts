import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BLOQUEO_SESION, debeBloquearAlVolver, TemporizadorInactividad, type EstadoInactividad } from './inactividad'

const MINUTO = 60 * 1000

function crear() {
  const estados: EstadoInactividad[] = []
  const bloquear = vi.fn()
  const temporizador = new TemporizadorInactividad({
    bloquear,
    alCambiarEstado: (estado) => estados.push(estado),
  })
  return { temporizador, bloquear, estados }
}

describe('D30: bloqueo al volver a la app', () => {
  const AHORA = 1_800_000_000_000

  it('se bloquea si pasaron más de 5 minutos desde la última interacción', () => {
    expect(debeBloquearAlVolver(AHORA - 5 * MINUTO - 1, AHORA)).toBe(true)
    expect(debeBloquearAlVolver(AHORA - 2 * 60 * MINUTO, AHORA)).toBe(true)
  })

  it('no se bloquea con 5 minutos o menos', () => {
    expect(debeBloquearAlVolver(AHORA - 5 * MINUTO, AHORA)).toBe(false)
    expect(debeBloquearAlVolver(AHORA - 30 * 1000, AHORA)).toBe(false)
  })

  it('sin marca guardada o con una marca en el futuro (reloj cambiado) no se bloquea', () => {
    expect(debeBloquearAlVolver(undefined, AHORA)).toBe(false)
    expect(debeBloquearAlVolver(AHORA + 10 * MINUTO, AHORA)).toBe(false)
  })

  it('los dos tiempos viven en una sola constante', () => {
    expect(BLOQUEO_SESION.regresoMs).toBe(5 * MINUTO)
    expect(BLOQUEO_SESION.inactividadMs).toBe(15 * MINUTO)
    expect(BLOQUEO_SESION.avisoMs).toBe(MINUTO)
  })
})

describe('D30: bloqueo por 15 minutos de inactividad con la app abierta', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('se bloquea a los 15 minutos sin actividad, con aviso un minuto antes', async () => {
    const { temporizador, bloquear, estados } = crear()
    temporizador.iniciar()

    await vi.advanceTimersByTimeAsync(14 * MINUTO)
    expect(estados).toEqual(['AVISO'])
    expect(bloquear).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(MINUTO)
    expect(bloquear).toHaveBeenCalledTimes(1)
    expect(temporizador.estadoActual).toBe('ACTIVA')
  })

  it('cualquier interacción durante el aviso lo cancela y la cuenta empieza de nuevo', async () => {
    const { temporizador, bloquear, estados } = crear()
    temporizador.iniciar()

    await vi.advanceTimersByTimeAsync(14 * MINUTO + 30 * 1000)
    expect(temporizador.estadoActual).toBe('AVISO')
    temporizador.registrarActividad()
    expect(estados).toEqual(['AVISO', 'ACTIVA'])

    // 15 minutos desde el ÚLTIMO toque, no desde el inicio.
    await vi.advanceTimersByTimeAsync(14 * MINUTO)
    expect(bloquear).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(MINUTO)
    expect(bloquear).toHaveBeenCalledTimes(1)
  })

  it('la cuenta sigue desde el tiempo ya transcurrido; si ya se cumplió, bloquea de inmediato', async () => {
    const parcial = crear()
    parcial.temporizador.iniciar(10 * MINUTO)
    await vi.advanceTimersByTimeAsync(5 * MINUTO)
    expect(parcial.bloquear).toHaveBeenCalledTimes(1)

    const vencida = crear()
    vencida.temporizador.iniciar(20 * MINUTO)
    expect(vencida.bloquear).toHaveBeenCalledTimes(1)
  })

  it('detenido (app bloqueada o desmontada) no bloquea ni reacciona a la actividad', async () => {
    const { temporizador, bloquear } = crear()
    temporizador.iniciar()
    temporizador.detener()
    temporizador.registrarActividad()
    await vi.advanceTimersByTimeAsync(60 * MINUTO)
    expect(bloquear).not.toHaveBeenCalled()
  })
})

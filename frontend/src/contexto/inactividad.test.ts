import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calcularInicioInactividad, TemporizadorInactividad, type EstadoInactividad } from './inactividad'

const MINUTO = 60 * 1000
const LIMITE = 30 * MINUTO

function crear(estadoRed: { enLinea: boolean; pendientes: number; servidor?: boolean }) {
  const estados: EstadoInactividad[] = []
  const cerrar = vi.fn()
  const temporizador = new TemporizadorInactividad({
    limiteMs: LIMITE,
    avisoMs: MINUTO,
    reintentoMs: 15 * 1000,
    puedeCerrar: async () =>
      estadoRed.enLinea && estadoRed.pendientes === 0 && (estadoRed.servidor ?? true),
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

    // Sin interacción, sigue esperando mientras haya cola; al vaciarse, cierra.
    await vi.advanceTimersByTimeAsync(5 * MINUTO)
    expect(cerrar).not.toHaveBeenCalled()

    red.pendientes = 0
    await vi.advanceTimersByTimeAsync(15 * 1000)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('E-15: la actividad después de expirar reinicia la cuenta; no cierra al vaciarse la cola', async () => {
    const red = { enLinea: false, pendientes: 2 }
    const { temporizador, cerrar } = crear(red)
    temporizador.iniciar()

    await vi.advanceTimersByTimeAsync(LIMITE)
    expect(temporizador.estadoActual).toBe('EXPIRADA_PENDIENTE')

    // El operador sigue vendiendo sin conexión; luego vuelve la red y la cola se vacía.
    temporizador.registrarActividad()
    expect(temporizador.estadoActual).toBe('ACTIVA')
    red.enLinea = true
    red.pendientes = 0
    temporizador.reintentarAhora()
    await vi.advanceTimersByTimeAsync(10 * MINUTO)
    expect(cerrar).not.toHaveBeenCalled()

    // Solo cierra cuando se cumplen las tres: 30 min sin interacción, conexión y cola vacía.
    await vi.advanceTimersByTimeAsync(20 * MINUTO)
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

  it('F-19: con red y cola vacía, no cierra si el servidor no responde', async () => {
    const red = { enLinea: true, pendientes: 0, servidor: false }
    const { temporizador, cerrar } = crear(red)
    temporizador.iniciar()

    await vi.advanceTimersByTimeAsync(LIMITE + 2 * MINUTO)
    expect(cerrar).not.toHaveBeenCalled()
    expect(temporizador.estadoActual).toBe('EXPIRADA_PENDIENTE')
  })

  it('F-19: cuando el servidor vuelve a responder y la cola está vacía, cierra en el siguiente reintento', async () => {
    const red = { enLinea: true, pendientes: 0, servidor: false }
    const { temporizador, cerrar } = crear(red)
    temporizador.iniciar()

    await vi.advanceTimersByTimeAsync(LIMITE)
    expect(temporizador.estadoActual).toBe('EXPIRADA_PENDIENTE')

    red.servidor = true
    await vi.advanceTimersByTimeAsync(15 * 1000)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('F-19 + E-15: la actividad durante la comprobación cancela el cierre, sin cierres dobles', async () => {
    let responder: (puede: boolean) => void = () => {}
    const puedeCerrar = vi.fn(
      () =>
        new Promise<boolean>((resolver) => {
          responder = resolver
        }),
    )
    const cerrar = vi.fn()
    const temporizador = new TemporizadorInactividad({
      limiteMs: LIMITE,
      avisoMs: MINUTO,
      reintentoMs: 15 * 1000,
      puedeCerrar,
      cerrar,
      alCambiarEstado: () => {},
    })
    temporizador.iniciar()

    // Vence la cuenta: empieza la comprobación (el servidor tarda en contestar).
    await vi.advanceTimersByTimeAsync(LIMITE)
    expect(puedeCerrar).toHaveBeenCalledTimes(1)

    // Mientras tanto, nada lanza una segunda comprobación.
    temporizador.reintentarAhora()
    expect(puedeCerrar).toHaveBeenCalledTimes(1)

    // El operador toca la pantalla y luego el servidor contesta que sí se podía.
    temporizador.registrarActividad()
    responder(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(cerrar).not.toHaveBeenCalled()
    expect(temporizador.estadoActual).toBe('ACTIVA')

    // La cuenta empezó de nuevo desde el toque.
    await vi.advanceTimersByTimeAsync(LIMITE)
    responder(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('F-20: con 10 minutos ya transcurridos (app cerrada), cierra 20 minutos después de abrir', async () => {
    const { temporizador, cerrar } = crear({ enLinea: true, pendientes: 0 })
    temporizador.iniciar(10 * MINUTO)

    await vi.advanceTimersByTimeAsync(19 * MINUTO)
    expect(temporizador.estadoActual).toBe('AVISO')
    expect(cerrar).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(MINUTO)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('F-20: con la cuenta ya vencida al abrir, aplica la regla de cierre de inmediato', async () => {
    const red = { enLinea: true, pendientes: 2 }
    const { temporizador, cerrar } = crear(red)
    temporizador.iniciar(45 * MINUTO)
    await vi.advanceTimersByTimeAsync(0)
    expect(cerrar).not.toHaveBeenCalled()
    expect(temporizador.estadoActual).toBe('EXPIRADA_PENDIENTE')

    // Sigue trabajando: cualquier toque reinicia la cuenta (E-15).
    temporizador.registrarActividad()
    expect(temporizador.estadoActual).toBe('ACTIVA')
  })
})

describe('F-20: calcularInicioInactividad', () => {
  const ahora = Date.UTC(2026, 9, 4, 15, 0)

  it('sin valor guardado, la cuenta empieza ahora', () => {
    expect(calcularInicioInactividad(undefined, ahora, LIMITE)).toEqual({ transcurridoMs: 0, vencida: false })
  })

  it('con menos de 30 minutos, la cuenta sigue desde la última actividad', () => {
    expect(calcularInicioInactividad(ahora - 10 * MINUTO, ahora, LIMITE)).toEqual({
      transcurridoMs: 10 * MINUTO,
      vencida: false,
    })
  })

  it('con 30 minutos o más, la cuenta está vencida', () => {
    expect(calcularInicioInactividad(ahora - LIMITE, ahora, LIMITE).vencida).toBe(true)
    expect(calcularInicioInactividad(ahora - 3 * LIMITE, ahora, LIMITE).vencida).toBe(true)
  })

  it('un valor en el futuro (reloj cambiado) se toma como ahora', () => {
    expect(calcularInicioInactividad(ahora + 2 * LIMITE, ahora, LIMITE)).toEqual({ transcurridoMs: 0, vencida: false })
  })
})

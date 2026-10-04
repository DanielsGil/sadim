import { afterEach, describe, expect, it, vi } from 'vitest'
import { servidorDisponible } from './salud'

describe('F-19: servidorDisponible', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('hace GET /api/health/ sin token ni caché y devuelve true solo con 200', async () => {
    const fetchSimulado = vi.fn(async () => new Response('{"status":"ok"}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSimulado)

    expect(await servidorDisponible()).toBe(true)
    const [ruta, opciones] = fetchSimulado.mock.calls[0] as unknown as [string, RequestInit]
    expect(ruta).toBe('/api/health/')
    expect(opciones.cache).toBe('no-store')
    expect(opciones.headers).toBeUndefined()
  })

  it('devuelve false con otro código o si la red falla', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    expect(await servidorDisponible()).toBe(false)

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await servidorDisponible()).toBe(false)
  })

  it('devuelve false si el servidor no contesta en 5 s', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_ruta: string, opciones: RequestInit) =>
          new Promise<Response>((_resolver, rechazar) => {
            opciones.signal?.addEventListener('abort', () => rechazar(new DOMException('abort', 'AbortError')))
          }),
      ),
    )
    const resultado = servidorDisponible()
    await vi.advanceTimersByTimeAsync(5 * 1000)
    expect(await resultado).toBe(false)
  })
})

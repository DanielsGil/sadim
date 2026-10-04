/** Máximo que se espera la respuesta de GET /api/health/ antes de darla por perdida. */
export const TIEMPO_MAXIMO_SALUD_MS = 5 * 1000

/**
 * F-19: ¿el servidor responde de verdad? `navigator.onLine` solo dice que hay
 * una red local; con el wifi de la cafetería sin internet, un portal cautivo
 * o Render dormido sigue en true. Esta función hace GET /api/health/ (público,
 * no toca la base de datos, D25) sin token, sin caché y con un máximo de 5 s,
 * y devuelve true solo si la respuesta es 200. Nunca lanza.
 */
export async function servidorDisponible(tiempoMaximoMs = TIEMPO_MAXIMO_SALUD_MS): Promise<boolean> {
  const controlador = new AbortController()
  const temporizador = setTimeout(() => controlador.abort(), tiempoMaximoMs)
  try {
    const respuesta = await fetch('/api/health/', { cache: 'no-store', signal: controlador.signal })
    return respuesta.status === 200
  } catch {
    return false
  } finally {
    clearTimeout(temporizador)
  }
}

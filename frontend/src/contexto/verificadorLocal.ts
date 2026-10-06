/**
 * D30 (E-22): verificador LOCAL de la contraseña, para desbloquear la app sin
 * conexión. En cada login (o desbloqueo) exitoso EN LÍNEA se guarda en Dexie
 * una sal aleatoria y una derivación PBKDF2-SHA256 de la contraseña con
 * 600.000 iteraciones (recomendación de OWASP), calculadas con WebCrypto.
 * NUNCA se guarda la contraseña: con la derivación no se puede reconstruir,
 * solo comprobar si una contraseña escrita da el mismo resultado.
 *
 * Ejemplo: María inicia sesión con conexión; se guarda {sal, derivación}. Más
 * tarde, sin internet, la app se bloquea; María escribe su contraseña, se
 * deriva con la misma sal y, si coincide, se desbloquea.
 *
 * Limitación aceptada (D30): si la contraseña se cambia en el servidor, la
 * anterior sigue desbloqueando SIN conexión hasta el siguiente login en línea.
 */

export const ITERACIONES_PBKDF2 = 600_000
const BYTES_SAL = 16
const BITS_DERIVACION = 256

export interface VerificadorLocal {
  usuario_id: string
  username: string
  /** Base64. */
  sal: string
  /** Base64 de la derivación PBKDF2-SHA256. */
  derivacion: string
  iteraciones: number
}

/** WebCrypto solo existe en contextos seguros (HTTPS o localhost). */
export function webCryptoDisponible(): boolean {
  return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined'
}

function aBase64(bytes: Uint8Array): string {
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario)
}

function deBase64(texto: string): Uint8Array<ArrayBuffer> {
  const binario = atob(texto)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return bytes
}

async function derivar(password: string, sal: Uint8Array<ArrayBuffer>, iteraciones: number): Promise<Uint8Array> {
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones },
    clave,
    BITS_DERIVACION,
  )
  return new Uint8Array(bits)
}

/** Comparación en tiempo constante: no se corta en el primer byte distinto. */
function igualesTiempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diferencia = 0
  for (let i = 0; i < a.length; i += 1) diferencia |= a[i] ^ b[i]
  return diferencia === 0
}

export async function crearVerificador(
  password: string,
  usuarioId: string,
  username: string,
  iteraciones: number = ITERACIONES_PBKDF2,
): Promise<VerificadorLocal> {
  const sal = crypto.getRandomValues(new Uint8Array(BYTES_SAL))
  const derivacion = await derivar(password, sal, iteraciones)
  return { usuario_id: usuarioId, username, sal: aBase64(sal), derivacion: aBase64(derivacion), iteraciones }
}

export async function verificarContrasena(password: string, verificador: VerificadorLocal): Promise<boolean> {
  const derivacion = await derivar(password, deBase64(verificador.sal), verificador.iteraciones)
  return igualesTiempoConstante(derivacion, deBase64(verificador.derivacion))
}

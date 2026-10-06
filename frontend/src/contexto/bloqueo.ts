import { ErrorApi } from '../api/errorApi'
import { crearVerificador, verificarContrasena, webCryptoDisponible, type VerificadorLocal } from './verificadorLocal'

/**
 * D30 (E-22): desbloqueo de la app. Reglas:
 * - Si el servidor responde (`servidorDisponible`, F-19), la contraseña se
 *   valida SOLO con el login de siempre, que entrega tokens nuevos; aunque
 *   falle por contraseña incorrecta, NO se recurre al verificador local, así
 *   un cambio de contraseña tiene efecto inmediato.
 * - Si no responde (sin wifi, wifi sin internet o Render dormido), se valida
 *   contra el verificador local; si no existe, hace falta conexión.
 * - Los fallos cuentan para la espera progresiva en ambos casos: tras
 *   `INTENTOS_SIN_ESPERA` fallos seguidos hay que esperar antes de otro intento.
 * Nada de esto toca la cola, la copia local ni las bandejas: solo lee y
 * escribe los intentos y el verificador.
 */

export const INTENTOS_SIN_ESPERA = 5
export const ESPERA_BASE_MS = 30 * 1000
export const ESPERA_MAXIMA_MS = 15 * 60 * 1000

export interface EstadoIntentos {
  fallos: number
  /** Antes de este momento (ms) no se admite otro intento; 0 = sin espera. */
  esperaHastaMs: number
}

export const SIN_INTENTOS: EstadoIntentos = { fallos: 0, esperaHastaMs: 0 }

/** 5 fallos → 30 s; 6 → 1 min; 7 → 2 min… hasta 15 min como máximo. */
export function esperaTrasFallos(fallos: number): number {
  if (fallos < INTENTOS_SIN_ESPERA) return 0
  return Math.min(ESPERA_MAXIMA_MS, ESPERA_BASE_MS * 2 ** (fallos - INTENTOS_SIN_ESPERA))
}

export function registrarFallo(estado: EstadoIntentos, ahoraMs: number): EstadoIntentos {
  const fallos = estado.fallos + 1
  const espera = esperaTrasFallos(fallos)
  return { fallos, esperaHastaMs: espera > 0 ? ahoraMs + espera : 0 }
}

export interface AlmacenBloqueo {
  leerIntentos: () => Promise<EstadoIntentos>
  guardarIntentos: (estado: EstadoIntentos) => Promise<void>
  leerVerificador: () => Promise<VerificadorLocal | undefined>
  guardarVerificador: (verificador: VerificadorLocal) => Promise<void>
}

export interface DependenciasDesbloqueo {
  almacen: AlmacenBloqueo
  servidorDisponible: () => Promise<boolean>
  /** Login de siempre (POST /api/auth/login/): guarda los tokens nuevos; lanza ErrorApi si falla. */
  loginServidor: (username: string, password: string) => Promise<void>
  ahora: () => number
  /** Solo para pruebas; por defecto, las 600.000 de OWASP. */
  iteraciones?: number
}

export type ResultadoDesbloqueo =
  | { tipo: 'DESBLOQUEADA'; via: 'SERVIDOR' | 'DISPOSITIVO' }
  | { tipo: 'INCORRECTA'; esperaMs: number }
  | { tipo: 'ESPERA'; esperaMs: number }
  | { tipo: 'SIN_VERIFICADOR' }
  | { tipo: 'ERROR'; mensaje: string }

/** Guarda un verificador nuevo (login o desbloqueo en línea exitoso). Si WebCrypto no existe, no hace nada. */
export async function renovarVerificador(
  almacen: Pick<AlmacenBloqueo, 'guardarVerificador'>,
  password: string,
  usuarioId: string,
  username: string,
  iteraciones?: number,
): Promise<void> {
  if (!webCryptoDisponible()) return
  await almacen.guardarVerificador(await crearVerificador(password, usuarioId, username, iteraciones))
}

export async function intentarDesbloqueo(
  sesion: { usuario_id: string; username: string },
  password: string,
  deps: DependenciasDesbloqueo,
): Promise<ResultadoDesbloqueo> {
  const { almacen } = deps
  const intentos = await almacen.leerIntentos()
  const ahora = deps.ahora()
  if (intentos.esperaHastaMs > ahora) {
    return { tipo: 'ESPERA', esperaMs: intentos.esperaHastaMs - ahora }
  }

  const fallar = async (): Promise<ResultadoDesbloqueo> => {
    const nuevo = registrarFallo(intentos, deps.ahora())
    await almacen.guardarIntentos(nuevo)
    return { tipo: 'INCORRECTA', esperaMs: Math.max(0, nuevo.esperaHastaMs - deps.ahora()) }
  }

  if (await deps.servidorDisponible()) {
    try {
      await deps.loginServidor(sesion.username, password)
    } catch (error) {
      if (error instanceof ErrorApi && error.code === 'CREDENCIALES_INVALIDAS') return fallar()
      // El servidor dejó de responder a mitad del intento: no cuenta como fallo.
      return { tipo: 'ERROR', mensaje: 'No se pudo validar la contraseña con el servidor. Intenta de nuevo.' }
    }
    await almacen.guardarIntentos(SIN_INTENTOS)
    try {
      await renovarVerificador(almacen, password, sesion.usuario_id, sesion.username, deps.iteraciones)
    } catch {
      // Sin verificador nuevo solo se pierde el desbloqueo offline hasta el siguiente login.
    }
    return { tipo: 'DESBLOQUEADA', via: 'SERVIDOR' }
  }

  const verificador = await almacen.leerVerificador()
  if (!verificador || verificador.usuario_id !== sesion.usuario_id || !webCryptoDisponible()) {
    return { tipo: 'SIN_VERIFICADOR' }
  }
  if (!(await verificarContrasena(password, verificador))) return fallar()
  await almacen.guardarIntentos(SIN_INTENTOS)
  return { tipo: 'DESBLOQUEADA', via: 'DISPOSITIVO' }
}

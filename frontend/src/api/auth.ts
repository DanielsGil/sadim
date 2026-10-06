import { borrarSesion, borrarVerificadorLocal, guardarSesion, guardarUltimaActividad } from '../db/baseLocal'
import type { Sesion } from '../tipos/dominio'
import { peticion } from './cliente'

/** POST /api/auth/login/ (CU-17). Guarda la sesión en Dexie si es exitoso. */
export async function iniciarSesion(username: string, password: string): Promise<Sesion> {
  const respuesta = await peticion<Sesion>('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  const sesion: Sesion = { ...respuesta, username }
  await guardarSesion(sesion)
  // F-20/D30: la cuenta de inactividad empieza al iniciar sesión.
  await guardarUltimaActividad(Date.now())
  return sesion
}

/**
 * Cierre de sesión MANUAL (D21): borra la sesión, la última actividad y el
 * verificador local de la contraseña (D30); nunca la cola ni la copia local.
 */
export async function cerrarSesion(): Promise<void> {
  await borrarSesion()
  await borrarVerificadorLocal()
}

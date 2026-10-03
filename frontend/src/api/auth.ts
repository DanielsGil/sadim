import { borrarSesion, guardarSesion } from '../db/baseLocal'
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
  return sesion
}

export async function cerrarSesion(): Promise<void> {
  await borrarSesion()
}

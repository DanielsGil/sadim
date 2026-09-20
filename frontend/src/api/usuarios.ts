import type { Usuario } from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato API v2 §4 (P-06, HU-044). Solo ADMIN.

export function listarUsuarios(): Promise<Usuario[]> {
  return peticion<Usuario[]>('/usuarios/')
}

export interface DatosCrearUsuario {
  nombre_completo: string
  username: string
  password: string
}

export function crearUsuario(datos: DatosCrearUsuario): Promise<Usuario> {
  return peticion<Usuario>('/usuarios/', {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export interface DatosEditarUsuario {
  nombre_completo?: string
  password?: string
  activo?: boolean
}

export function editarUsuario(id: string, datos: DatosEditarUsuario): Promise<Usuario> {
  return peticion<Usuario>(`/usuarios/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  })
}

/** PATCH {activo}: baja lógica y reactivación. */
export function cambiarActivoUsuario(id: string, activo: boolean): Promise<Usuario> {
  return editarUsuario(id, { activo })
}

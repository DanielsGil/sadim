import { v4 as uuidv4 } from 'uuid'
import type { Mesa } from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato API v2 §7.1 (HU-043). GET: ADMIN y OPERADOR. POST/PATCH: solo ADMIN.

export function listarMesas(filtros: { activa?: boolean } = {}): Promise<Mesa[]> {
  const parametros = new URLSearchParams()
  if (filtros.activa !== undefined) parametros.set('activa', String(filtros.activa))
  const cadena = parametros.toString()
  return peticion<Mesa[]>(`/mesas/${cadena ? `?${cadena}` : ''}`)
}

export function crearMesa(numero: number): Promise<Mesa> {
  return peticion<Mesa>('/mesas/', {
    method: 'POST',
    body: JSON.stringify({ operation_id: uuidv4(), numero }),
  })
}

export function cambiarActivaMesa(id: string, activa: boolean): Promise<Mesa> {
  return peticion<Mesa>(`/mesas/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ activa }),
  })
}

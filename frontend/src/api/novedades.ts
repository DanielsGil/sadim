import type { Novedad } from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato v2 §13 (HU-052). GET y PATCH: ambos roles. Marcar atendida requiere conexión.

export function listarNovedades(filtros: { atendida?: boolean } = {}): Promise<Novedad[]> {
  const parametros = new URLSearchParams()
  if (filtros.atendida !== undefined) parametros.set('atendida', String(filtros.atendida))
  const cadena = parametros.toString()
  return peticion<Novedad[]>(`/sync/novedades/${cadena ? `?${cadena}` : ''}`)
}

export function marcarNovedadAtendida(id: string, atendida: boolean): Promise<Novedad> {
  return peticion<Novedad>(`/sync/novedades/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ atendida }),
  })
}

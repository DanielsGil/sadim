import { v4 as uuidv4 } from 'uuid'
import type { CierreCaja } from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato API v2 §11 (HU-028). Todo el recurso es solo ADMIN.

export function listarCierres(fecha?: string): Promise<CierreCaja[]> {
  const cadena = fecha ? `?fecha=${fecha}` : ''
  return peticion<CierreCaja[]>(`/cierres-caja/${cadena}`)
}

export function crearCierre(
  fecha: string,
  efectivoContado: number,
  observaciones?: string,
): Promise<CierreCaja> {
  return peticion<CierreCaja>('/cierres-caja/', {
    method: 'POST',
    body: JSON.stringify({
      operation_id: uuidv4(),
      fecha,
      efectivo_contado: efectivoContado,
      observaciones: observaciones || null,
    }),
  })
}

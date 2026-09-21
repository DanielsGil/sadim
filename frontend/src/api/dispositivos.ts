import type { Dispositivo } from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato v2 §4.1 (HU-051). Todo el recurso es de ADMIN y requiere conexión (E-04).

export function listarDispositivos(): Promise<Dispositivo[]> {
  return peticion<Dispositivo[]>('/dispositivos/')
}

export function registrarDispositivo(identificador: string, nombre: string, esCaja = false): Promise<Dispositivo> {
  return peticion<Dispositivo>('/dispositivos/', {
    method: 'POST',
    body: JSON.stringify({ identificador, nombre, es_caja: esCaja }),
  })
}

export function autorizarDispositivo(id: string, autorizado: boolean): Promise<Dispositivo> {
  return peticion<Dispositivo>(`/dispositivos/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ autorizado_offline: autorizado }),
  })
}

export function desactivarDispositivo(id: string): Promise<Dispositivo> {
  return peticion<Dispositivo>(`/dispositivos/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ activo: false }),
  })
}

import { v4 as uuidv4 } from 'uuid'
import type { Mesa } from '../tipos/dominio'
import { cachearCatalogo, estaEnLinea, leerCatalogoLocal, leerUnoDelCatalogoLocal } from '../sync/cacheCatalogo'
import { escribir } from '../sync/enrutador'
import { peticion } from './cliente'

// Contrato API v2 §7.1 (HU-043). GET: ADMIN y OPERADOR. POST/PATCH: solo ADMIN.

export async function listarMesas(filtros: { activa?: boolean } = {}): Promise<Mesa[]> {
  const parametros = new URLSearchParams()
  if (filtros.activa !== undefined) parametros.set('activa', String(filtros.activa))
  const cadena = parametros.toString()
  try {
    const mesas = await peticion<Mesa[]>(`/mesas/${cadena ? `?${cadena}` : ''}`)
    await cachearCatalogo('mesas', mesas)
    return mesas
  } catch (error) {
    if (estaEnLinea()) throw error
    const locales = await leerCatalogoLocal<Mesa>('mesas')
    return filtros.activa === undefined ? locales : locales.filter((mesa) => mesa.activa === filtros.activa)
  }
}

export function crearMesa(numero: number): Promise<Mesa> {
  const id = uuidv4()
  return escribir<Mesa>({
    resource: 'mesas',
    action: 'CREATE',
    idObjeto: id,
    payload: { id, numero },
    llamarEnLinea: (operationId) =>
      peticion<Mesa>('/mesas/', { method: 'POST', body: JSON.stringify({ operation_id: operationId, numero }) }),
    reflejarLocal: () => ({ id, operation_id: uuidv4(), numero, activa: true, estado: 'DISPONIBLE' }),
  })
}

export function cambiarActivaMesa(id: string, activa: boolean): Promise<Mesa> {
  return escribir<Mesa>({
    resource: 'mesas',
    action: 'UPDATE',
    idObjeto: id,
    payload: { id, activa },
    llamarEnLinea: () => peticion<Mesa>(`/mesas/${id}/`, { method: 'PATCH', body: JSON.stringify({ activa }) }),
    reflejarLocal: async () => {
      const actual = await leerUnoDelCatalogoLocal<Mesa>('mesas', id)
      return { ...(actual ?? { id, operation_id: uuidv4(), numero: 0, estado: 'DISPONIBLE' as const }), activa }
    },
  })
}

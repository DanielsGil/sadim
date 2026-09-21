import { v4 as uuidv4 } from 'uuid'
import {
  guardarConfiguracionPagosLocal,
  guardarModulosLocal,
  obtenerConfiguracionPagosLocal,
  obtenerModulosLocal,
} from '../db/baseLocal'
import type { ConfiguracionModulo, ConfiguracionPago } from '../tipos/dominio'
import { estaEnLinea } from '../sync/cacheCatalogo'
import { escribir } from '../sync/enrutador'
import { peticion } from './cliente'

// Contrato API v2 §12 y §12.1 (HU-042, HU-049). GET: ADMIN y OPERADOR. PATCH: solo ADMIN.
// Las lecturas guardan copia local (los módulos activos y los medios de pago
// se necesitan sin conexión). Cambiar módulos pasa por sync/enrutador
// (HU-030, D17); cambiar los medios de pago requiere conexión (E-03).

export async function obtenerConfiguracionModulos(): Promise<ConfiguracionModulo> {
  try {
    const modulos = await peticion<ConfiguracionModulo>('/configuracion/modulos/')
    await guardarModulosLocal(modulos)
    return modulos
  } catch (error) {
    if (estaEnLinea()) throw error
    const local = await obtenerModulosLocal()
    if (!local) throw error
    return local
  }
}

export type CambiosConfiguracionModulo = Partial<
  Pick<ConfiguracionModulo, 'ventas_activo' | 'inventario_activo' | 'servicios_activo' | 'finanzas_activo'>
>

export function actualizarConfiguracionModulos(
  cambios: CambiosConfiguracionModulo,
): Promise<ConfiguracionModulo> {
  return escribir<ConfiguracionModulo>({
    resource: 'configuracion.modulos',
    action: 'UPDATE',
    // Fila única (singleton): no hay un id de negocio; se usa uno solo para la fila local.
    idObjeto: uuidv4(),
    payload: { ...cambios },
    llamarEnLinea: async () => {
      const actualizado = await peticion<ConfiguracionModulo>('/configuracion/modulos/', {
        method: 'PATCH',
        body: JSON.stringify(cambios),
      })
      await guardarModulosLocal(actualizado)
      return actualizado
    },
    reflejarLocal: async () => {
      const local = await obtenerModulosLocal()
      if (!local) throw new Error('No hay una copia local de la configuración de módulos.')
      const actualizado = { ...local, ...cambios }
      await guardarModulosLocal(actualizado)
      return actualizado
    },
  })
}

export async function obtenerConfiguracionPagos(): Promise<ConfiguracionPago> {
  try {
    const pagos = await peticion<ConfiguracionPago>('/configuracion/pagos/')
    await guardarConfiguracionPagosLocal(pagos)
    return pagos
  } catch (error) {
    if (estaEnLinea()) throw error
    const local = await obtenerConfiguracionPagosLocal()
    if (!local) throw error
    return local
  }
}

export type CambiosConfiguracionPago = Partial<
  Pick<
    ConfiguracionPago,
    'acepta_efectivo' | 'acepta_transferencia' | 'acepta_qr' | 'nequi_titular' | 'nequi_llave'
  >
>

export function actualizarConfiguracionPagos(
  cambios: CambiosConfiguracionPago,
): Promise<ConfiguracionPago> {
  return peticion<ConfiguracionPago>('/configuracion/pagos/', {
    method: 'PATCH',
    body: JSON.stringify(cambios),
  })
}

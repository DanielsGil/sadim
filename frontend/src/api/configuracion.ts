import type { ConfiguracionModulo, ConfiguracionPago } from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato API v2 §12 y §12.1 (HU-042, HU-049). GET: ADMIN y OPERADOR. PATCH: solo ADMIN.

export function obtenerConfiguracionModulos(): Promise<ConfiguracionModulo> {
  return peticion<ConfiguracionModulo>('/configuracion/modulos/')
}

export type CambiosConfiguracionModulo = Partial<
  Pick<ConfiguracionModulo, 'ventas_activo' | 'inventario_activo' | 'servicios_activo' | 'finanzas_activo'>
>

export function actualizarConfiguracionModulos(
  cambios: CambiosConfiguracionModulo,
): Promise<ConfiguracionModulo> {
  return peticion<ConfiguracionModulo>('/configuracion/modulos/', {
    method: 'PATCH',
    body: JSON.stringify(cambios),
  })
}

export function obtenerConfiguracionPagos(): Promise<ConfiguracionPago> {
  return peticion<ConfiguracionPago>('/configuracion/pagos/')
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

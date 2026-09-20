// Nombres de campos iguales al ERD y al Contrato de API (regla de
// .claude/rules/frontend-pwa.md): no se traducen ni se renombran.

export type Rol = 'ADMIN' | 'OPERADOR'

/** Sesión guardada en el almacén local "meta" (ERD §10). */
export interface Sesion {
  access_token: string
  refresh_token: string
  usuario_id: string
  rol: Rol
}

export interface Categoria {
  id: string
  operation_id: string
  nombre: string
}

export type TipoProducto = 'INSUMO_PRODUCCION' | 'REVENTA_DIRECTA'

export interface Producto {
  id: string
  operation_id: string
  categoria_id: string
  nombre: string
  tipo: TipoProducto
  precio_venta: number
  costo_produccion: number | null
  stock_actual: number
  stock_minimo: number
  controla_stock: boolean
  unidad_medida: string
  activo: boolean
}

/** Usuario (Contrato API v2 §4, HU-044). Nunca incluye password ni su hash. */
export interface Usuario {
  id: string
  nombre_completo: string
  username: string
  rol: Rol
  activo: boolean
  fecha_creacion: string
}

/** ConfiguracionModulo (Contrato API v2 §12, HU-042). Fila única. */
export interface ConfiguracionModulo {
  ventas_activo: boolean
  inventario_activo: boolean
  servicios_activo: boolean
  finanzas_activo: boolean
  actualizado_por_id: string | null
  actualizado_en: string
}

/** ConfiguracionPago (Contrato API v2 §12.1, HU-049). Fila única. */
export interface ConfiguracionPago {
  acepta_efectivo: boolean
  acepta_transferencia: boolean
  acepta_qr: boolean
  nequi_titular: string | null
  nequi_llave: string | null
  actualizado_por_id: string
  actualizado_en: string
}

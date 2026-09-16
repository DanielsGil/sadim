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

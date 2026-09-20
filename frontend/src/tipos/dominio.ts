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

export type EstadoMesa = 'DISPONIBLE' | 'OCUPADA'

/** Mesa (Contrato API v2 §7.1, HU-043). estado es derivado: el backend lo calcula. */
export interface Mesa {
  id: string
  operation_id: string
  numero: number
  activa: boolean
  estado: EstadoMesa
}

export type TipoVenta = 'RAPIDA' | 'SESION_DINAMICA'
export type EstadoVenta = 'ABIERTA' | 'CERRADA' | 'CANCELADA'
export type MedioPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'QR'
export type EstadoPago = 'CONFIRMADO' | 'PENDIENTE_VERIFICACION'

export interface DetalleVenta {
  id: string
  operation_id: string
  venta_id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

/** Venta (Contrato API v2 §7, HU-012..HU-019, HU-048). total y subtotal los calcula el backend. */
export interface Venta {
  id: string
  operation_id: string
  tipo: TipoVenta
  estado: EstadoVenta
  mesa_id: string | null
  fecha_apertura: string
  fecha_cierre: string | null
  medio_pago: MedioPago | null
  estado_pago: EstadoPago | null
  total: number
  detalles: DetalleVenta[]
}

export type TipoMovimientoInventario =
  | 'ENTRADA'
  | 'SALIDA_VENTA'
  | 'SALIDA_SERVICIO'
  | 'MERMA'
  | 'AJUSTE_MANUAL'

/** MovimientoInventario (Contrato API v2 §9, HU-025 adelantado). Histórico: no se edita. */
export interface MovimientoInventario {
  id: string
  operation_id: string
  producto_id: string
  usuario_id: string
  venta_id: string | null
  tipo: TipoMovimientoInventario
  cantidad: number
  sentido: 'SUMA' | 'RESTA' | null
  fecha: string
  motivo: string | null
}

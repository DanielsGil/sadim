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
// D15 (Bloque 4): ANULADO se agrega para un pago electrónico que nunca llega.
export type EstadoPago = 'CONFIRMADO' | 'PENDIENTE_VERIFICACION' | 'ANULADO'

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

export type EstadoOrden = 'RECIBIDO' | 'EN_PROCESO' | 'LISTO' | 'ENTREGADO'
export type EstadoConsumo = 'PENDIENTE' | 'APLICADO'

/** Abono (Contrato API v2 §8, HU-022). */
export interface Abono {
  id: string
  operation_id: string
  valor: number
  medio_pago: MedioPago
  estado_pago: EstadoPago
  fecha: string
  observacion: string | null
}

/** ConsumoOrden (Contrato API v2 §8, HU-041). No mueve inventario hasta ENTREGADO. */
export interface ConsumoOrden {
  id: string
  operation_id: string
  producto_id: string
  cantidad: number
  estado: EstadoConsumo
  fecha_registro: string
}

/** CostoOperativoOrden (Contrato API v2 §8, HU-023). Solo visible para ADMIN. */
export interface CostoOperativoOrden {
  id: string
  operation_id: string
  concepto: string
  valor: number
}

/**
 * OrdenTrabajo (Contrato API v2 §8, HU-020..HU-023, HU-041). saldo_pendiente
 * y utilidad_neta los calcula el backend; utilidad_neta nunca llega al
 * OPERADOR (queda ausente de la respuesta, no en null).
 */
export interface OrdenTrabajo {
  id: string
  operation_id: string
  usuario_id: string
  cliente_nombre: string
  cliente_telefono: string | null
  descripcion: string
  fecha_solicitud: string
  fecha_entrega_estimada: string
  estado: EstadoOrden
  costo_total: number
  saldo_pendiente: number
  utilidad_neta?: number
}

/** GET /api/ordenes-trabajo/{id}/ (D13): agrega la lista de abonos. */
export interface OrdenTrabajoDetalle extends OrdenTrabajo {
  abonos: Abono[]
}

/** GET /api/inventario/stock/ (Contrato v2 §9, HU-024). */
export interface StockProducto {
  id: string
  categoria_id: string
  nombre: string
  tipo: TipoProducto
  unidad_medida: string
  controla_stock: boolean
  stock_actual: number | null
  stock_minimo: number | null
  alerta_stock_minimo: boolean
}

export type TipoMovimientoCaja = 'INGRESO_VENTA' | 'INGRESO_ABONO' | 'GASTO'

/** MovimientoCaja (Contrato API v2 §10, HU-029/HU-050). */
export interface MovimientoCaja {
  id: string
  operation_id: string
  usuario_id: string
  venta_id: string | null
  abono_id: string | null
  cierre_caja_id: string | null
  tipo: TipoMovimientoCaja
  medio_pago: MedioPago
  estado_pago: EstadoPago
  valor: number
  concepto: string | null
  fecha: string
  fecha_confirmacion: string | null
  motivo_anulacion: string | null
}

/** GET /api/movimientos-caja/resumen/?fecha= (Contrato v2 §10, CU-20). */
export interface ResumenCaja {
  fecha: string
  ingresos_ventas: number
  ingresos_abonos: number
  gastos: number
  neto: number
  por_medio_pago: Record<MedioPago, number>
  pendiente_verificacion: number
}

/** CierreCaja (Contrato API v2 §11, HU-028). Los totales los calcula el backend. */
export interface CierreCaja {
  id: string
  operation_id: string
  usuario_id: string
  fecha: string
  periodo_inicio: string
  periodo_fin: string
  total_ingresos_ventas: number
  total_ingresos_abonos: number
  total_gastos: number
  total_neto: number
  efectivo_esperado: number
  efectivo_contado: number
  diferencia: number
  observaciones: string | null
  fecha_creacion: string
}

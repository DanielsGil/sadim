// Nombres de campos iguales al ERD y al Contrato de API (regla de
// .claude/rules/frontend-pwa.md): no se traducen ni se renombran.

export type Rol = 'ADMIN' | 'OPERADOR'

/** Sesión guardada en el almacén local "meta" (ERD §10). */
export interface Sesion {
  access_token: string
  refresh_token: string
  usuario_id: string
  rol: Rol
  /**
   * E-16: el `username` que la persona escribió al iniciar sesión, guardado
   * SOLO en el dispositivo para mostrar quién está conectado. El login del
   * Contrato no devuelve el nombre y /api/usuarios/ es solo ADMIN; las
   * sesiones guardadas antes de este cambio no lo tienen.
   */
  username?: string
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
  /** D31: MovimientoCaja GASTO de la compra (solo ENTRADA con costo); null si no hubo. */
  gasto_id?: string | null
}

/** CANCELADA: D29 (Lote 7, E-20). */
export type EstadoOrden = 'RECIBIDO' | 'EN_PROCESO' | 'LISTO' | 'ENTREGADO' | 'CANCELADA'
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
  /** D29: null mientras la orden no esté CANCELADA. */
  motivo_cancelacion?: string | null
  cancelada_por_id?: string | null
  fecha_cancelacion?: string | null
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
  /** D31: ENTRADA de mercancía cuya compra registra este GASTO. */
  movimiento_inventario_id?: string | null
  /** E-21: solo en /pendientes/ y en el histórico del ADMIN. */
  origen?: OrigenMovimientoCaja
}

/** E-21 (Lote 7, amplía el Contrato v2 §10): de dónde viene un movimiento de caja. */
export type OrigenMovimientoCaja =
  | {
      tipo: 'VENTA'
      venta_id: string
      venta_tipo: 'RAPIDA' | 'SESION_DINAMICA'
      mesa_numero: number | null
      descripcion: string
      fecha: string
      cobrado_por: string
      productos: { nombre: string; cantidad: number }[]
    }
  | {
      tipo: 'ABONO'
      abono_id: string
      orden_id: string
      cliente_nombre: string
      orden_descripcion: string
      fecha: string
      cobrado_por: string
    }
  | { tipo: 'GASTO'; concepto: string | null }

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

/** Dispositivo (Contrato API v2 §4.1, HU-051). Solo ADMIN administra el recurso. */
export interface Dispositivo {
  id: string
  identificador: string
  nombre: string
  es_caja: boolean
  autorizado_offline: boolean
  activo: boolean
  registrado_por_id: string
  fecha_registro: string
  ultima_sincronizacion: string | null
}

// --- Sincronización offline (Bloque 5a/5b, ERD §8-§10, Contrato v2 §13) ---

/** D17: lista cerrada de combinaciones resource/action sincronizables. */
export type RecursoSincronizable =
  | 'categorias'
  | 'productos'
  | 'mesas'
  | 'ventas'
  | 'ventas.detalles'
  | 'ventas.cerrar'
  | 'ventas.cancelar'
  | 'ordenes-trabajo'
  | 'ordenes-trabajo.estado'
  | 'ordenes-trabajo.cancelar'
  | 'ordenes-trabajo.abonos'
  | 'ordenes-trabajo.consumos'
  | 'ordenes-trabajo.costos'
  | 'inventario.movimientos'
  | 'movimientos-caja'
  | 'configuracion.modulos'

export type AccionSincronizable = 'CREATE' | 'UPDATE' | 'DELETE'

/** Una fila de la cola_sincronizacion (ERD §10): una operación aún no confirmada por el servidor. */
export interface OperacionCola {
  operation_id: string
  resource: RecursoSincronizable
  action: AccionSincronizable
  fecha_cliente: string
  payload: Record<string, unknown>
  creado_en: string
  intentos: number
}

export type EstadoResultadoSync = 'APLICADA' | 'DUPLICADA' | 'RECHAZADA' | 'CONFLICTO'

/** Un elemento de {"results": [...]} en la respuesta de POST /api/sync/ (Contrato v2 §13). */
export interface ResultadoOperacionSync {
  operation_id: string
  estado: EstadoResultadoSync
  objeto_id: string | null
  estado_original?: EstadoResultadoSync
  codigo_conflicto?: string
  mensaje?: string
}

/** Novedad (GET/PATCH /api/sync/novedades/, HU-052): un RECHAZADA/CONFLICTO de sincronización. */
export interface Novedad {
  id: string
  operation_id: string
  dispositivo_id: string | null
  usuario_id: string
  recurso: string
  accion: string
  estado: 'RECHAZADA' | 'CONFLICTO'
  codigo_conflicto: string | null
  mensaje: string | null
  objeto_id: string | null
  fecha_cliente: string
  fecha_procesamiento: string
  atendida: boolean
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

/**
 * GET /api/cierres-caja/vista-previa/ (D28, extiende el Contrato v2 §11):
 * lo que consolidaría un cierre registrado ahora. La calcula el backend con el
 * mismo criterio D14 que el cierre; no se guarda nada.
 */
export interface VistaPreviaCierre {
  periodo_inicio: string
  periodo_fin: string
  total_ingresos_ventas: number
  total_ingresos_abonos: number
  total_gastos: number
  total_neto: number
  efectivo_esperado: number
  /** Ingresos (sin gastos) que entrarían al cierre, por medio de pago. */
  por_medio_pago: Record<MedioPago, number>
  cantidad_movimientos: number
}

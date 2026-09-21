import { baseLocal, leerCopiaLectura, obtenerSesion, type FilaOperacionLocal } from '../db/baseLocal'
import type { MedioPago, MovimientoCaja, MovimientoInventario, Producto, StockProducto } from '../tipos/dominio'
import { leerCatalogoLocal, leerUnoDelCatalogoLocal, parchearCatalogoLocal } from './cacheCatalogo'

/**
 * Vistas locales de Inventario y Caja para MOSTRAR sin conexión (HU-030,
 * D22). Stock, alertas y estados de pago son provisionales: el backend los
 * recalcula al sincronizar y la reconciliación reemplaza la copia.
 */

export const claveCopiaMovimientos = (productoId?: string) => `movimientos:${productoId ?? 'todos'}`
export const CLAVE_COPIA_PENDIENTES_CAJA = 'pendientes-caja'

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

async function filasEnCola(resource: string): Promise<FilaOperacionLocal[]> {
  const enCola = new Set((await baseLocal.cola_sincronizacion.toArray()).map((op) => op.operation_id))
  const filas = await baseLocal.operaciones_locales.where('resource').equals(resource).toArray()
  return filas.filter((fila) => enCola.has(fila.operation_id)).sort((a, b) => a.creado_en.localeCompare(b.creado_en))
}

/** Stock derivado de la copia local del catálogo (ya parcheada con los movimientos en cola). */
export async function listarStockLocal(categoriaId?: string, tipo?: string): Promise<StockProducto[]> {
  const productos = await leerCatalogoLocal<Producto>('productos')
  return productos
    .filter(
      (producto) =>
        producto.activo &&
        (!categoriaId || producto.categoria_id === categoriaId) &&
        (!tipo || producto.tipo === tipo),
    )
    .map((producto) => ({
      id: producto.id,
      categoria_id: producto.categoria_id,
      nombre: producto.nombre,
      tipo: producto.tipo,
      unidad_medida: producto.unidad_medida,
      controla_stock: producto.controla_stock,
      // R-18: sin control de existencias no hay stock ni alerta.
      stock_actual: producto.controla_stock ? producto.stock_actual : null,
      stock_minimo: producto.controla_stock ? producto.stock_minimo : null,
      alerta_stock_minimo: producto.controla_stock && producto.stock_actual <= producto.stock_minimo,
    }))
}

/** Suma o resta `delta` al stock_actual de la copia local de un producto con controla_stock. */
export async function ajustarStockLocal(productoId: string, delta: number): Promise<void> {
  const producto = await leerUnoDelCatalogoLocal<Producto>('productos', productoId)
  if (producto?.controla_stock) {
    await parchearCatalogoLocal<Producto>('productos', productoId, {
      stock_actual: redondear(producto.stock_actual + delta),
    })
  }
}

export async function movimientoInventarioProvisional(fila: FilaOperacionLocal): Promise<MovimientoInventario> {
  const sesion = await obtenerSesion()
  return {
    id: fila.id,
    operation_id: fila.operation_id,
    producto_id: String(fila.datos.producto_id),
    usuario_id: sesion?.usuario_id ?? '',
    venta_id: null,
    tipo: fila.datos.tipo as MovimientoInventario['tipo'],
    cantidad: Number(fila.datos.cantidad),
    sentido: (fila.datos.sentido as MovimientoInventario['sentido']) ?? null,
    fecha: fila.creado_en,
    motivo: (fila.datos.motivo as string | undefined) ?? null,
  }
}

export async function listarMovimientosLocal(productoId?: string): Promise<MovimientoInventario[]> {
  const base = (await leerCopiaLectura<MovimientoInventario[]>(claveCopiaMovimientos(productoId))) ?? []
  const filas = (await filasEnCola('inventario.movimientos')).filter(
    (fila) => !productoId || fila.datos.producto_id === productoId,
  )
  const locales = await Promise.all(filas.map(movimientoInventarioProvisional))
  return [...locales.reverse(), ...base]
}

export function gastoProvisional(fila: FilaOperacionLocal, usuarioId: string): MovimientoCaja {
  const medioPago = fila.datos.medio_pago as MedioPago
  return {
    id: fila.id,
    operation_id: fila.operation_id,
    usuario_id: usuarioId,
    venta_id: null,
    abono_id: null,
    cierre_caja_id: null,
    tipo: 'GASTO',
    medio_pago: medioPago,
    // D22 / regla de dominio: TRANSFERENCIA y QR nunca se muestran confirmados sin conexión.
    estado_pago: medioPago === 'EFECTIVO' ? 'CONFIRMADO' : 'PENDIENTE_VERIFICACION',
    valor: Number(fila.datos.valor),
    concepto: (fila.datos.concepto as string | undefined) ?? null,
    fecha: fila.creado_en,
    fecha_confirmacion: medioPago === 'EFECTIVO' ? fila.creado_en : null,
    motivo_anulacion: null,
  }
}

/** Últimos pendientes que devolvió el servidor + los gastos electrónicos que aún están en la cola. */
export async function listarPendientesCajaLocal(): Promise<MovimientoCaja[]> {
  const base = (await leerCopiaLectura<MovimientoCaja[]>(CLAVE_COPIA_PENDIENTES_CAJA)) ?? []
  const sesion = await obtenerSesion()
  const gastosEnCola = (await filasEnCola('movimientos-caja'))
    .filter((fila) => fila.datos.medio_pago !== 'EFECTIVO')
    .map((fila) => gastoProvisional(fila, sesion?.usuario_id ?? ''))
  return [...base, ...gastosEnCola]
}

/** operation_id de los movimientos de caja que aún no llegaron al servidor (no se pueden confirmar todavía). */
export async function operationIdsMovimientosEnCola(): Promise<Set<string>> {
  return new Set((await filasEnCola('movimientos-caja')).map((fila) => fila.operation_id))
}

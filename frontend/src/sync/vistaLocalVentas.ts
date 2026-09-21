import { baseLocal } from '../db/baseLocal'
import { leerUnoDelCatalogoLocal } from './cacheCatalogo'
import type { DetalleVenta, Producto, Venta } from '../tipos/dominio'

/**
 * Reconstruye, solo para MOSTRAR sin conexión (D22), una Venta a partir de
 * las filas que este dispositivo guardó en operaciones_locales al encolar
 * (abrir sesión, agregar/quitar detalle, cerrar, cancelar). Todo aquí es
 * "provisional": el backend recalcula total/estado_pago/stock al sincronizar.
 */
export async function obtenerVentaLocal(ventaId: string): Promise<Venta | undefined> {
  const filaVenta = await buscarPorResourceEId('ventas', ventaId)
  if (!filaVenta) return undefined

  const datosVenta = filaVenta.datos as Record<string, unknown>
  const hijas = (await baseLocal.operaciones_locales.where('referencia_id').equals(ventaId).toArray()).sort(
    (a, b) => a.creado_en.localeCompare(b.creado_en),
  )

  let estado: Venta['estado'] = 'ABIERTA'
  let medioPago: Venta['medio_pago'] = null
  let estadoPago: Venta['estado_pago'] = null
  let fechaCierre: string | null = null
  const detallesPorId = new Map<string, DetalleVenta>()

  for (const fila of hijas) {
    const datos = fila.datos as Record<string, unknown>
    if (fila.resource === 'ventas.detalles' && fila.action === 'CREATE') {
      const producto = await leerUnoDelCatalogoLocal<Producto>('productos', String(datos.producto_id))
      const cantidad = Number(datos.cantidad)
      const precioUnitario = Number(datos.precio_unitario ?? producto?.precio_venta ?? 0)
      detallesPorId.set(fila.id, {
        id: fila.id,
        operation_id: fila.operation_id,
        venta_id: ventaId,
        producto_id: String(datos.producto_id),
        cantidad,
        precio_unitario: precioUnitario,
        subtotal: precioUnitario * cantidad,
      })
    } else if (fila.resource === 'ventas.detalles' && fila.action === 'DELETE') {
      detallesPorId.delete(fila.id)
    } else if (fila.resource === 'ventas.cerrar') {
      estado = 'CERRADA'
      medioPago = datos.medio_pago as Venta['medio_pago']
      // D22: nunca se muestra un pago electrónico como confirmado sin conexión.
      estadoPago = medioPago === 'EFECTIVO' ? 'CONFIRMADO' : 'PENDIENTE_VERIFICACION'
      fechaCierre = fila.creado_en
    } else if (fila.resource === 'ventas.cancelar') {
      estado = 'CANCELADA'
    }
  }

  const detalles = [...detallesPorId.values()]
  const total = detalles.reduce((suma, detalle) => suma + detalle.subtotal, 0)

  return {
    id: ventaId,
    operation_id: filaVenta.operation_id,
    tipo: datosVenta.tipo as Venta['tipo'],
    estado,
    mesa_id: (datosVenta.mesa_id as string) ?? null,
    fecha_apertura: filaVenta.creado_en,
    fecha_cierre: fechaCierre,
    medio_pago: medioPago,
    estado_pago: estadoPago,
    total,
    detalles,
  }
}

async function buscarPorResourceEId(resource: string, id: string) {
  return baseLocal.operaciones_locales.where('resource').equals(resource).filter((fila) => fila.id === id).first()
}

/** Para el mapa de mesas offline: encuentra la sesión (si existe) abierta en este dispositivo para esa mesa. */
export async function buscarVentaLocalPorMesa(mesaId: string): Promise<Venta | undefined> {
  const filas = await baseLocal.operaciones_locales.where('resource').equals('ventas').toArray()
  const filaVenta = filas.find((fila) => (fila.datos as Record<string, unknown>).mesa_id === mesaId)
  if (!filaVenta) return undefined
  return obtenerVentaLocal(filaVenta.id)
}

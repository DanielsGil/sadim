import { v4 as uuidv4 } from 'uuid'
import type { DetalleVenta, MedioPago, Producto, Venta } from '../tipos/dominio'
import { estaEnLinea, leerUnoDelCatalogoLocal, parchearCatalogoLocal } from '../sync/cacheCatalogo'
import { escribir } from '../sync/enrutador'
import { buscarVentaLocalPorMesa, obtenerVentaLocal } from '../sync/vistaLocalVentas'
import { peticion } from './cliente'

// Contrato API v2 §7 (HU-012..HU-019, HU-048). Todo el recurso: ADMIN y OPERADOR.
// Toda escritura pasa por sync/enrutador (HU-030, D17): con conexión y cola
// vacía llama en línea; si no, encola y refleja un resultado "provisional"
// (D22) a partir de la copia local.

export interface FiltrosVentas {
  estado?: string
  mesaId?: string
}

export async function listarVentas(filtros: FiltrosVentas = {}): Promise<Venta[]> {
  const parametros = new URLSearchParams()
  if (filtros.estado) parametros.set('estado', filtros.estado)
  if (filtros.mesaId) parametros.set('mesa', filtros.mesaId)
  const cadena = parametros.toString()
  try {
    return await peticion<Venta[]>(`/ventas/${cadena ? `?${cadena}` : ''}`)
  } catch (error) {
    if (estaEnLinea() || !filtros.mesaId) throw error
    const venta = await buscarVentaLocalPorMesa(filtros.mesaId)
    if (!venta) return []
    if (filtros.estado && venta.estado !== filtros.estado) return []
    return [venta]
  }
}

export interface ItemVentaRapida {
  producto_id: string
  cantidad: number
}

export async function crearVentaRapida(medioPago: MedioPago, detalles: ItemVentaRapida[]): Promise<Venta> {
  const idVenta = uuidv4()
  const idsDetalles = detalles.map(() => uuidv4())

  return escribir<Venta>({
    resource: 'ventas',
    action: 'CREATE',
    idObjeto: idVenta,
    payload: {
      id: idVenta,
      tipo: 'RAPIDA',
      medio_pago: medioPago,
      detalles: detalles.map((detalle, indice) => ({
        id: idsDetalles[indice],
        operation_id: uuidv4(),
        producto_id: detalle.producto_id,
        cantidad: detalle.cantidad,
      })),
    },
    llamarEnLinea: (operationId) =>
      peticion<Venta>('/ventas/', {
        method: 'POST',
        body: JSON.stringify({
          operation_id: operationId,
          tipo: 'RAPIDA',
          medio_pago: medioPago,
          detalles: detalles.map((detalle) => ({ operation_id: uuidv4(), ...detalle })),
        }),
      }),
    reflejarLocal: (operationId) => reflejarVentaRapidaLocal(idVenta, operationId, medioPago, detalles, idsDetalles),
  })
}

async function reflejarVentaRapidaLocal(
  idVenta: string,
  operationId: string,
  medioPago: MedioPago,
  detalles: ItemVentaRapida[],
  idsDetalles: string[],
): Promise<Venta> {
  const ahora = new Date().toISOString()
  const detallesReflejados: DetalleVenta[] = []
  for (const [indice, detalle] of detalles.entries()) {
    const producto = await leerUnoDelCatalogoLocal<Producto>('productos', detalle.producto_id)
    const precioUnitario = producto?.precio_venta ?? 0
    detallesReflejados.push({
      id: idsDetalles[indice],
      operation_id: uuidv4(),
      venta_id: idVenta,
      producto_id: detalle.producto_id,
      cantidad: detalle.cantidad,
      precio_unitario: precioUnitario,
      subtotal: precioUnitario * detalle.cantidad,
    })
  }
  return {
    id: idVenta,
    operation_id: operationId,
    tipo: 'RAPIDA',
    estado: 'CERRADA',
    mesa_id: null,
    fecha_apertura: ahora,
    fecha_cierre: ahora,
    medio_pago: medioPago,
    // D22: un pago electrónico nunca se muestra confirmado sin conexión.
    estado_pago: medioPago === 'EFECTIVO' ? 'CONFIRMADO' : 'PENDIENTE_VERIFICACION',
    total: detallesReflejados.reduce((suma, detalle) => suma + detalle.subtotal, 0),
    detalles: detallesReflejados,
  }
}

export function abrirSesion(mesaId: string): Promise<Venta> {
  const idVenta = uuidv4()
  return escribir<Venta>({
    resource: 'ventas',
    action: 'CREATE',
    idObjeto: idVenta,
    payload: { id: idVenta, tipo: 'SESION_DINAMICA', mesa_id: mesaId },
    llamarEnLinea: (operationId) =>
      peticion<Venta>('/ventas/', {
        method: 'POST',
        body: JSON.stringify({ operation_id: operationId, tipo: 'SESION_DINAMICA', mesa_id: mesaId }),
      }),
    reflejarLocal: async (operationId) => {
      await parchearCatalogoLocal('mesas', mesaId, { estado: 'OCUPADA' })
      const ahora = new Date().toISOString()
      return {
        id: idVenta,
        operation_id: operationId,
        tipo: 'SESION_DINAMICA',
        estado: 'ABIERTA',
        mesa_id: mesaId,
        fecha_apertura: ahora,
        fecha_cierre: null,
        medio_pago: null,
        estado_pago: null,
        total: 0,
        detalles: [],
      }
    },
  })
}

export function agregarDetalle(ventaId: string, productoId: string, cantidad: number): Promise<DetalleVenta> {
  const idDetalle = uuidv4()
  return escribir<DetalleVenta>({
    resource: 'ventas.detalles',
    action: 'CREATE',
    idObjeto: idDetalle,
    referenciaId: ventaId,
    payload: { id: idDetalle, venta_id: ventaId, producto_id: productoId, cantidad },
    llamarEnLinea: (operationId) =>
      peticion<DetalleVenta>(`/ventas/${ventaId}/detalles/`, {
        method: 'POST',
        body: JSON.stringify({ operation_id: operationId, producto_id: productoId, cantidad }),
      }),
    reflejarLocal: async (operationId) => {
      const producto = await leerUnoDelCatalogoLocal<Producto>('productos', productoId)
      const precioUnitario = producto?.precio_venta ?? 0
      return {
        id: idDetalle,
        operation_id: operationId,
        venta_id: ventaId,
        producto_id: productoId,
        cantidad,
        precio_unitario: precioUnitario,
        subtotal: precioUnitario * cantidad,
      }
    },
  })
}

export function quitarDetalle(ventaId: string, detalleId: string): Promise<void> {
  return escribir<void>({
    resource: 'ventas.detalles',
    action: 'DELETE',
    idObjeto: detalleId,
    referenciaId: ventaId,
    payload: { id: detalleId, venta_id: ventaId },
    llamarEnLinea: (operationId) =>
      peticion<void>(`/ventas/${ventaId}/detalles/${detalleId}/`, {
        method: 'DELETE',
        body: JSON.stringify({ operation_id: operationId }),
      }),
    reflejarLocal: async () => {
      // Se registra como una operación "hija" propia (resource distinto) en
      // vez de borrar la fila original: vistaLocalVentas la resta al armar
      // la lista de detalles vigentes de la venta.
    },
  })
}

export function cerrarVenta(ventaId: string, medioPago: MedioPago): Promise<Venta> {
  return escribir<Venta>({
    resource: 'ventas.cerrar',
    action: 'UPDATE',
    idObjeto: ventaId,
    referenciaId: ventaId,
    payload: { venta_id: ventaId, medio_pago: medioPago },
    llamarEnLinea: (operationId) =>
      peticion<Venta>(`/ventas/${ventaId}/cerrar/`, {
        method: 'PATCH',
        body: JSON.stringify({ operation_id: operationId, medio_pago: medioPago }),
      }),
    reflejarLocal: async () => {
      const venta = await obtenerVentaLocal(ventaId)
      if (venta?.mesa_id) await parchearCatalogoLocal('mesas', venta.mesa_id, { estado: 'DISPONIBLE' })
      return (
        venta ?? {
          id: ventaId,
          operation_id: uuidv4(),
          tipo: 'SESION_DINAMICA',
          estado: 'CERRADA',
          mesa_id: null,
          fecha_apertura: new Date().toISOString(),
          fecha_cierre: new Date().toISOString(),
          medio_pago: medioPago,
          estado_pago: medioPago === 'EFECTIVO' ? 'CONFIRMADO' : 'PENDIENTE_VERIFICACION',
          total: 0,
          detalles: [],
        }
      )
    },
  })
}

export function cancelarVenta(ventaId: string): Promise<Venta> {
  return escribir<Venta>({
    resource: 'ventas.cancelar',
    action: 'UPDATE',
    idObjeto: ventaId,
    referenciaId: ventaId,
    payload: { venta_id: ventaId },
    llamarEnLinea: (operationId) =>
      peticion<Venta>(`/ventas/${ventaId}/cancelar/`, {
        method: 'PATCH',
        body: JSON.stringify({ operation_id: operationId }),
      }),
    reflejarLocal: async () => {
      const venta = await obtenerVentaLocal(ventaId)
      if (venta?.mesa_id) await parchearCatalogoLocal('mesas', venta.mesa_id, { estado: 'DISPONIBLE' })
      return (
        venta ?? {
          id: ventaId,
          operation_id: uuidv4(),
          tipo: 'SESION_DINAMICA',
          estado: 'CANCELADA',
          mesa_id: null,
          fecha_apertura: new Date().toISOString(),
          fecha_cierre: null,
          medio_pago: null,
          estado_pago: null,
          total: 0,
          detalles: [],
        }
      )
    },
  })
}

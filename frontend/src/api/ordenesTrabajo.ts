import { v4 as uuidv4 } from 'uuid'
import { guardarCopiaLectura } from '../db/baseLocal'
import type {
  Abono,
  ConsumoOrden,
  CostoOperativoOrden,
  EstadoOrden,
  MedioPago,
  OrdenTrabajo,
  OrdenTrabajoDetalle,
} from '../tipos/dominio'
import { estaEnLinea } from '../sync/cacheCatalogo'
import { escribir } from '../sync/enrutador'
import { hayPendientesDe } from '../sync/pendientes'
import {
  CLAVE_COPIA_ORDENES,
  claveCopiaConsumos,
  claveCopiaCostos,
  claveCopiaOrden,
  descontarConsumosDelCatalogoLocal,
  listarConsumosLocal,
  listarOrdenesLocal,
  obtenerCostosLocal,
  obtenerOrdenLocal,
} from '../sync/vistaLocalOrdenes'
import { peticion } from './cliente'

// Contrato API v2 §8 (HU-020, HU-021, HU-022, HU-041, HU-023). Todo el
// recurso es de ADMIN y OPERADOR, salvo /costos/ que es solo ADMIN.
// Toda escritura pasa por sync/enrutador (HU-030, D17): con conexión y cola
// vacía llama en línea; si no, encola y refleja un resultado "provisional"
// (D22). Las lecturas guardan una copia local para poder mostrarlas sin conexión.

export async function listarOrdenes(estado?: string): Promise<OrdenTrabajo[]> {
  const cadena = estado ? `?estado=${estado}` : ''
  // Con operaciones sin sincronizar, el servidor aún no las conoce: se muestra la vista local.
  if (await hayPendientesDe('ordenes-trabajo')) {
    const local = await listarOrdenesLocal(estado)
    if (local.length > 0) return local
  }
  try {
    const ordenes = await peticion<OrdenTrabajo[]>(`/ordenes-trabajo/${cadena}`)
    if (!estado) await guardarCopiaLectura(CLAVE_COPIA_ORDENES, ordenes)
    return ordenes
  } catch (error) {
    if (estaEnLinea()) throw error
    return listarOrdenesLocal(estado)
  }
}

export async function obtenerOrden(ordenId: string): Promise<OrdenTrabajoDetalle> {
  if (await hayPendientesDe('ordenes-trabajo')) {
    const local = await obtenerOrdenLocal(ordenId)
    if (local) return local
  }
  try {
    const orden = await peticion<OrdenTrabajoDetalle>(`/ordenes-trabajo/${ordenId}/`)
    await guardarCopiaLectura(claveCopiaOrden(ordenId), orden)
    return orden
  } catch (error) {
    if (estaEnLinea()) throw error
    const local = await obtenerOrdenLocal(ordenId)
    if (!local) throw error
    return local
  }
}

export interface DatosNuevaOrden {
  cliente_nombre: string
  cliente_telefono?: string
  descripcion: string
  fecha_entrega_estimada: string
  costo_total: number
}

export function crearOrden(datos: DatosNuevaOrden): Promise<OrdenTrabajo> {
  const idOrden = uuidv4()
  return escribir<OrdenTrabajo>({
    resource: 'ordenes-trabajo',
    action: 'CREATE',
    idObjeto: idOrden,
    // costo_total es un dato de entrada del pedido; saldo_pendiente nunca se envía (lo calcula el servidor).
    payload: { id: idOrden, ...datos },
    llamarEnLinea: (operationId) =>
      peticion<OrdenTrabajo>('/ordenes-trabajo/', {
        method: 'POST',
        body: JSON.stringify({ operation_id: operationId, ...datos }),
      }),
    reflejarLocal: async () => {
      const orden = await obtenerOrdenLocal(idOrden)
      if (!orden) throw new Error('No se pudo registrar la orden en este dispositivo.')
      return orden
    },
  })
}

export function cambiarEstadoOrden(ordenId: string, estado: EstadoOrden): Promise<{ id: string; estado: EstadoOrden }> {
  return escribir<{ id: string; estado: EstadoOrden }>({
    resource: 'ordenes-trabajo.estado',
    action: 'UPDATE',
    idObjeto: ordenId,
    referenciaId: ordenId,
    payload: { orden_id: ordenId, estado },
    llamarEnLinea: (operationId) =>
      peticion(`/ordenes-trabajo/${ordenId}/estado/`, {
        method: 'PATCH',
        body: JSON.stringify({ operation_id: operationId, estado }),
      }),
    reflejarLocal: async () => {
      if (estado === 'ENTREGADO') await descontarConsumosDelCatalogoLocal(ordenId)
      return { id: ordenId, estado }
    },
  })
}

/** D29: solo ADMIN; motivo obligatorio. Sincronizable (ordenes-trabajo.cancelar UPDATE). */
export function cancelarOrden(ordenId: string, motivo: string): Promise<OrdenTrabajo> {
  return escribir<OrdenTrabajo>({
    resource: 'ordenes-trabajo.cancelar',
    action: 'UPDATE',
    idObjeto: ordenId,
    referenciaId: ordenId,
    payload: { orden_id: ordenId, motivo },
    llamarEnLinea: (operationId) =>
      peticion<OrdenTrabajo>(`/ordenes-trabajo/${ordenId}/cancelar/`, {
        method: 'PATCH',
        body: JSON.stringify({ operation_id: operationId, motivo }),
      }),
    reflejarLocal: async () => {
      const orden = await obtenerOrdenLocal(ordenId)
      if (!orden) throw new Error('No se encontró la orden en este dispositivo.')
      return orden
    },
  })
}

export function registrarAbono(
  ordenId: string,
  valor: number,
  medioPago: MedioPago,
  observacion?: string,
): Promise<Abono & { saldo_pendiente: number }> {
  const idAbono = uuidv4()
  return escribir<Abono & { saldo_pendiente: number }>({
    resource: 'ordenes-trabajo.abonos',
    action: 'CREATE',
    idObjeto: idAbono,
    referenciaId: ordenId,
    payload: { id: idAbono, orden_id: ordenId, valor, medio_pago: medioPago, observacion },
    llamarEnLinea: (operationId) =>
      peticion(`/ordenes-trabajo/${ordenId}/abonos/`, {
        method: 'POST',
        body: JSON.stringify({ operation_id: operationId, valor, medio_pago: medioPago, observacion }),
      }),
    reflejarLocal: async (operationId) => {
      const orden = await obtenerOrdenLocal(ordenId)
      return {
        id: idAbono,
        operation_id: operationId,
        valor,
        medio_pago: medioPago,
        // D22: un abono electrónico nunca se muestra confirmado sin conexión.
        estado_pago: medioPago === 'EFECTIVO' ? 'CONFIRMADO' : 'PENDIENTE_VERIFICACION',
        fecha: new Date().toISOString(),
        observacion: observacion ?? null,
        saldo_pendiente: orden?.saldo_pendiente ?? 0,
      }
    },
  })
}

export async function listarConsumos(ordenId: string): Promise<ConsumoOrden[]> {
  if ((await hayPendientesDe('ordenes-trabajo')) && (await obtenerOrdenLocal(ordenId))) {
    return listarConsumosLocal(ordenId)
  }
  try {
    const consumos = await peticion<ConsumoOrden[]>(`/ordenes-trabajo/${ordenId}/consumos/`)
    await guardarCopiaLectura(claveCopiaConsumos(ordenId), consumos)
    return consumos
  } catch (error) {
    if (estaEnLinea()) throw error
    return listarConsumosLocal(ordenId)
  }
}

export function registrarConsumo(ordenId: string, productoId: string, cantidad: number): Promise<ConsumoOrden> {
  const idConsumo = uuidv4()
  return escribir<ConsumoOrden>({
    resource: 'ordenes-trabajo.consumos',
    action: 'CREATE',
    idObjeto: idConsumo,
    referenciaId: ordenId,
    payload: { id: idConsumo, orden_id: ordenId, producto_id: productoId, cantidad },
    llamarEnLinea: (operationId) =>
      peticion<ConsumoOrden>(`/ordenes-trabajo/${ordenId}/consumos/`, {
        method: 'POST',
        body: JSON.stringify({ operation_id: operationId, producto_id: productoId, cantidad }),
      }),
    reflejarLocal: (operationId) => ({
      id: idConsumo,
      operation_id: operationId,
      producto_id: productoId,
      cantidad,
      estado: 'PENDIENTE',
      fecha_registro: new Date().toISOString(),
    }),
  })
}

export interface CostosOrden {
  costos: CostoOperativoOrden[]
  utilidad_neta: number
}

export async function obtenerCostos(ordenId: string): Promise<CostosOrden> {
  if ((await hayPendientesDe('ordenes-trabajo')) && (await obtenerOrdenLocal(ordenId))) {
    return obtenerCostosLocal(ordenId)
  }
  try {
    const costos = await peticion<CostosOrden>(`/ordenes-trabajo/${ordenId}/costos/`)
    await guardarCopiaLectura(claveCopiaCostos(ordenId), costos)
    return costos
  } catch (error) {
    if (estaEnLinea()) throw error
    return obtenerCostosLocal(ordenId)
  }
}

export function registrarCosto(ordenId: string, concepto: string, valor: number): Promise<CostoOperativoOrden> {
  const idCosto = uuidv4()
  return escribir<CostoOperativoOrden>({
    resource: 'ordenes-trabajo.costos',
    action: 'CREATE',
    idObjeto: idCosto,
    referenciaId: ordenId,
    payload: { id: idCosto, orden_id: ordenId, concepto, valor },
    llamarEnLinea: (operationId) =>
      peticion<CostoOperativoOrden>(`/ordenes-trabajo/${ordenId}/costos/`, {
        method: 'POST',
        body: JSON.stringify({ operation_id: operationId, concepto, valor }),
      }),
    reflejarLocal: (operationId) => ({ id: idCosto, operation_id: operationId, concepto, valor }),
  })
}

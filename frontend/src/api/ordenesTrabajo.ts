import { v4 as uuidv4 } from 'uuid'
import type {
  Abono,
  ConsumoOrden,
  CostoOperativoOrden,
  EstadoOrden,
  MedioPago,
  OrdenTrabajo,
  OrdenTrabajoDetalle,
} from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato API v2 §8 (HU-020, HU-021, HU-022, HU-041, HU-023). Todo el
// recurso es de ADMIN y OPERADOR, salvo /costos/ que es solo ADMIN.

export function listarOrdenes(estado?: string): Promise<OrdenTrabajo[]> {
  const cadena = estado ? `?estado=${estado}` : ''
  return peticion<OrdenTrabajo[]>(`/ordenes-trabajo/${cadena}`)
}

export function obtenerOrden(ordenId: string): Promise<OrdenTrabajoDetalle> {
  return peticion<OrdenTrabajoDetalle>(`/ordenes-trabajo/${ordenId}/`)
}

export interface DatosNuevaOrden {
  cliente_nombre: string
  cliente_telefono?: string
  descripcion: string
  fecha_entrega_estimada: string
  costo_total: number
}

export function crearOrden(datos: DatosNuevaOrden): Promise<OrdenTrabajo> {
  return peticion<OrdenTrabajo>('/ordenes-trabajo/', {
    method: 'POST',
    body: JSON.stringify({ operation_id: uuidv4(), ...datos }),
  })
}

export function cambiarEstadoOrden(ordenId: string, estado: EstadoOrden): Promise<{ id: string; estado: EstadoOrden }> {
  return peticion(`/ordenes-trabajo/${ordenId}/estado/`, {
    method: 'PATCH',
    body: JSON.stringify({ operation_id: uuidv4(), estado }),
  })
}

export function registrarAbono(
  ordenId: string,
  valor: number,
  medioPago: MedioPago,
  observacion?: string,
): Promise<Abono & { saldo_pendiente: number }> {
  return peticion(`/ordenes-trabajo/${ordenId}/abonos/`, {
    method: 'POST',
    body: JSON.stringify({ operation_id: uuidv4(), valor, medio_pago: medioPago, observacion }),
  })
}

export function listarConsumos(ordenId: string): Promise<ConsumoOrden[]> {
  return peticion<ConsumoOrden[]>(`/ordenes-trabajo/${ordenId}/consumos/`)
}

export function registrarConsumo(ordenId: string, productoId: string, cantidad: number): Promise<ConsumoOrden> {
  return peticion<ConsumoOrden>(`/ordenes-trabajo/${ordenId}/consumos/`, {
    method: 'POST',
    body: JSON.stringify({ operation_id: uuidv4(), producto_id: productoId, cantidad }),
  })
}

export interface CostosOrden {
  costos: CostoOperativoOrden[]
  utilidad_neta: number
}

export function obtenerCostos(ordenId: string): Promise<CostosOrden> {
  return peticion<CostosOrden>(`/ordenes-trabajo/${ordenId}/costos/`)
}

export function registrarCosto(ordenId: string, concepto: string, valor: number): Promise<CostoOperativoOrden> {
  return peticion<CostoOperativoOrden>(`/ordenes-trabajo/${ordenId}/costos/`, {
    method: 'POST',
    body: JSON.stringify({ operation_id: uuidv4(), concepto, valor }),
  })
}

import { baseLocal, leerCopiaLectura, obtenerSesion, type FilaOperacionLocal } from '../db/baseLocal'
import type {
  Abono,
  ConsumoOrden,
  CostoOperativoOrden,
  EstadoOrden,
  OrdenTrabajo,
  OrdenTrabajoDetalle,
  Producto,
} from '../tipos/dominio'
import { leerUnoDelCatalogoLocal, parchearCatalogoLocal } from './cacheCatalogo'

/**
 * Vista local de órdenes de trabajo para MOSTRAR sin conexión (HU-030, D22).
 * Se arma con la última copia que devolvió el servidor + las operaciones de
 * este dispositivo que TODAVÍA están en la cola (las ya sincronizadas ya
 * están reflejadas en lo que el servidor devolvió en la reconciliación). Todo
 * lo calculado aquí (saldo_pendiente, utilidad_neta, stock) es provisional:
 * nunca se envía y el backend lo recalcula al sincronizar.
 */

export const CLAVE_COPIA_ORDENES = 'ordenes'
export const claveCopiaOrden = (ordenId: string) => `orden:${ordenId}`
export const claveCopiaConsumos = (ordenId: string) => `consumos:${ordenId}`
export const claveCopiaCostos = (ordenId: string) => `costos:${ordenId}`

export interface CostosOrdenLocal {
  costos: CostoOperativoOrden[]
  utilidad_neta: number
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}

async function filasPendientesDeOrdenes(): Promise<FilaOperacionLocal[]> {
  const enCola = new Set((await baseLocal.cola_sincronizacion.toArray()).map((op) => op.operation_id))
  const filas = await baseLocal.operaciones_locales.where('resource').startsWith('ordenes-trabajo').toArray()
  return filas.filter((fila) => enCola.has(fila.operation_id)).sort((a, b) => a.creado_en.localeCompare(b.creado_en))
}

async function baseListaOrdenes(): Promise<OrdenTrabajo[]> {
  const copia = await leerCopiaLectura<OrdenTrabajo[]>(CLAVE_COPIA_ORDENES)
  if (copia) return copia
  const fila = await baseLocal.meta.get('ordenes_no_entregadas')
  return (fila?.valor as OrdenTrabajo[] | undefined) ?? []
}

async function ordenDesdeCreacion(fila: FilaOperacionLocal): Promise<OrdenTrabajo> {
  const sesion = await obtenerSesion()
  const datos = fila.datos
  const costoTotal = Number(datos.costo_total)
  return {
    id: fila.id,
    operation_id: fila.operation_id,
    usuario_id: sesion?.usuario_id ?? '',
    cliente_nombre: String(datos.cliente_nombre),
    cliente_telefono: (datos.cliente_telefono as string | undefined) ?? null,
    descripcion: String(datos.descripcion),
    fecha_solicitud: fila.creado_en,
    fecha_entrega_estimada: String(datos.fecha_entrega_estimada),
    estado: 'RECIBIDO',
    costo_total: costoTotal,
    saldo_pendiente: costoTotal,
    // utilidad_neta nunca se le muestra al OPERADOR (D5/D13).
    ...(sesion?.rol === 'ADMIN' ? { utilidad_neta: costoTotal } : {}),
  }
}

function abonoProvisional(fila: FilaOperacionLocal): Abono {
  const medioPago = fila.datos.medio_pago as Abono['medio_pago']
  return {
    id: fila.id,
    operation_id: fila.operation_id,
    valor: Number(fila.datos.valor),
    medio_pago: medioPago,
    // D22: un pago electrónico nunca se muestra confirmado sin conexión.
    estado_pago: medioPago === 'EFECTIVO' ? 'CONFIRMADO' : 'PENDIENTE_VERIFICACION',
    fecha: fila.creado_en,
    observacion: (fila.datos.observacion as string | undefined) ?? null,
  }
}

function aplicarOperaciones<T extends OrdenTrabajo>(orden: T, filas: FilaOperacionLocal[]): T {
  const resultado: T = { ...orden }
  for (const fila of filas) {
    if (fila.resource === 'ordenes-trabajo.estado') {
      resultado.estado = fila.datos.estado as EstadoOrden
    } else if (fila.resource === 'ordenes-trabajo.abonos') {
      resultado.saldo_pendiente = Math.max(0, redondear(resultado.saldo_pendiente - Number(fila.datos.valor)))
    } else if (fila.resource === 'ordenes-trabajo.costos' && resultado.utilidad_neta !== undefined) {
      resultado.utilidad_neta = redondear(resultado.utilidad_neta - Number(fila.datos.valor))
    }
  }
  return resultado
}

export async function listarOrdenesLocal(estado?: string): Promise<OrdenTrabajo[]> {
  const filas = await filasPendientesDeOrdenes()
  const base = await baseListaOrdenes()
  const ordenes = [...base]

  for (const fila of filas) {
    if (fila.resource === 'ordenes-trabajo' && fila.action === 'CREATE' && !ordenes.some((o) => o.id === fila.id)) {
      ordenes.push(await ordenDesdeCreacion(fila))
    }
  }

  return ordenes
    .map((orden) => aplicarOperaciones(orden, filas.filter((fila) => fila.referencia_id === orden.id)))
    .filter((orden) => !estado || orden.estado === estado)
}

export async function obtenerOrdenLocal(ordenId: string): Promise<OrdenTrabajoDetalle | undefined> {
  const filas = await filasPendientesDeOrdenes()

  let base = await leerCopiaLectura<OrdenTrabajoDetalle>(claveCopiaOrden(ordenId))
  if (!base) {
    const deLista = (await baseListaOrdenes()).find((orden) => orden.id === ordenId)
    if (deLista) base = { ...deLista, abonos: [] }
  }
  if (!base) {
    const creacion = filas.find((fila) => fila.resource === 'ordenes-trabajo' && fila.id === ordenId)
    if (creacion) base = { ...(await ordenDesdeCreacion(creacion)), abonos: [] }
  }
  if (!base) return undefined

  const hijas = filas.filter((fila) => fila.referencia_id === ordenId)
  const orden = aplicarOperaciones(base, hijas)
  const abonosLocales = hijas.filter((fila) => fila.resource === 'ordenes-trabajo.abonos').map(abonoProvisional)
  return { ...orden, abonos: [...base.abonos, ...abonosLocales] }
}

export async function listarConsumosLocal(ordenId: string): Promise<ConsumoOrden[]> {
  const base = (await leerCopiaLectura<ConsumoOrden[]>(claveCopiaConsumos(ordenId))) ?? []
  const filas = (await filasPendientesDeOrdenes()).filter(
    (fila) => fila.resource === 'ordenes-trabajo.consumos' && fila.referencia_id === ordenId,
  )
  const locales: ConsumoOrden[] = filas.map((fila) => ({
    id: fila.id,
    operation_id: fila.operation_id,
    producto_id: String(fila.datos.producto_id),
    cantidad: Number(fila.datos.cantidad),
    estado: 'PENDIENTE',
    fecha_registro: fila.creado_en,
  }))
  return [...base, ...locales]
}

export async function obtenerCostosLocal(ordenId: string): Promise<CostosOrdenLocal> {
  const copia = await leerCopiaLectura<CostosOrdenLocal>(claveCopiaCostos(ordenId))
  const filas = (await filasPendientesDeOrdenes()).filter(
    (fila) => fila.resource === 'ordenes-trabajo.costos' && fila.referencia_id === ordenId,
  )
  const locales: CostoOperativoOrden[] = filas.map((fila) => ({
    id: fila.id,
    operation_id: fila.operation_id,
    concepto: String(fila.datos.concepto),
    valor: Number(fila.datos.valor),
  }))
  const gastoLocal = locales.reduce((suma, costo) => suma + costo.valor, 0)
  // La copia del servidor aún no incluye los costos en cola: se restan para mostrarlos.
  // Sin copia, la orden local (obtenerOrdenLocal) ya los descuenta.
  const utilidadNeta = copia
    ? redondear(copia.utilidad_neta - gastoLocal)
    : ((await obtenerOrdenLocal(ordenId))?.utilidad_neta ?? 0)
  return { costos: [...(copia?.costos ?? []), ...locales], utilidad_neta: utilidadNeta }
}

/**
 * Al pasar una orden a ENTREGADO sin conexión, refleja en la copia local del
 * catálogo el descuento que el servidor hará al sincronizar (solo consumos
 * PENDIENTES de productos con controla_stock). Provisional: la reconciliación
 * lo reemplaza con el stock real.
 */
export async function descontarConsumosDelCatalogoLocal(ordenId: string): Promise<void> {
  const consumos = await listarConsumosLocal(ordenId)
  for (const consumo of consumos) {
    if (consumo.estado !== 'PENDIENTE') continue
    const producto = await leerUnoDelCatalogoLocal<Producto>('productos', consumo.producto_id)
    if (producto?.controla_stock) {
      await parchearCatalogoLocal<Producto>('productos', producto.id, {
        stock_actual: redondear(producto.stock_actual - consumo.cantidad),
      })
    }
  }
}

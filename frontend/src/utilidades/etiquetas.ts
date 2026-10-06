import type { EstadoPago, MovimientoCaja, MovimientoInventario } from '../tipos/dominio'
import { formatoFechaHora, formatoMoneda } from './formato'

/**
 * Etiquetas legibles para códigos internos que se muestran en pantalla
 * (A6/A7). Un solo lugar para todos los mapas: los códigos siguen siendo
 * los del ERD/Contrato; esto es solo presentación.
 */

/** A6 (F-6): estado_pago de MovimientoCaja, Venta y Abono (incluye ANULADO, D15). */
export const ETIQUETA_ESTADO_PAGO: Record<EstadoPago, string> = {
  CONFIRMADO: 'Confirmado',
  PENDIENTE_VERIFICACION: 'Pendiente de verificación',
  ANULADO: 'Anulado',
}

/** A7: columna «Tipo» del historial de inventario; AJUSTE_MANUAL según su sentido. */
export function etiquetaMovimientoInventario(movimiento: Pick<MovimientoInventario, 'tipo' | 'sentido'>): string {
  switch (movimiento.tipo) {
    case 'ENTRADA':
      return 'Ingreso de mercancía'
    case 'SALIDA_VENTA':
      return 'Salida por venta'
    case 'SALIDA_SERVICIO':
      return 'Salida por orden de trabajo'
    case 'MERMA':
      return 'Merma'
    case 'AJUSTE_MANUAL':
      return movimiento.sentido === 'SUMA' ? 'Ajuste manual (suma)' : 'Ajuste manual (resta)'
    default:
      return movimiento.tipo
  }
}

/** A7: columna «Recurso» de Novedades, para los recursos D17 que encola el frontend. */
const ETIQUETA_RECURSO_SYNC: Record<string, string> = {
  ventas: 'Venta',
  'ventas.detalles': 'Producto en cuenta de mesa',
  'ventas.cerrar': 'Cobro de cuenta de mesa',
  'ventas.cancelar': 'Cancelación de cuenta de mesa',
  mesas: 'Mesa',
  'ordenes-trabajo': 'Orden de trabajo',
  'ordenes-trabajo.estado': 'Cambio de estado de orden',
  'ordenes-trabajo.cancelar': 'Cancelación de orden',
  'ordenes-trabajo.abonos': 'Abono',
  'ordenes-trabajo.consumos': 'Consumo de orden',
  'ordenes-trabajo.costos': 'Costo operativo',
  'inventario.movimientos': 'Movimiento de inventario',
  'movimientos-caja': 'Gasto',
  'configuracion.modulos': 'Configuración de módulos',
}

/** Recurso sin etiqueta conocida: se muestra el código tal cual. */
export function etiquetaRecursoSync(recurso: string): string {
  return ETIQUETA_RECURSO_SYNC[recurso] ?? recurso
}

/**
 * E-21 (Lote 7): de dónde viene un movimiento de caja, en una línea. Ej.:
 * «Mesa 3 · 6 oct 2026, 2:32 p. m. · cobrado por María · 2 Carne Arroz, 1 Coca Cola 350».
 * Sin `origen` (p. ej. un gasto todavía en la cola) cae al concepto o al tipo.
 */
export function describirOrigenPago(movimiento: Pick<MovimientoCaja, 'tipo' | 'concepto' | 'origen'>): string {
  const origen = movimiento.origen
  if (!origen) return movimiento.concepto ?? movimiento.tipo
  if (origen.tipo === 'VENTA') {
    const productos = origen.productos
      .map((p) => `${Number(p.cantidad).toLocaleString('es-CO')} ${p.nombre}`)
      .join(', ')
    return [origen.descripcion, formatoFechaHora(origen.fecha), `cobrado por ${origen.cobrado_por}`, productos]
      .filter(Boolean)
      .join(' · ')
  }
  if (origen.tipo === 'ABONO') {
    return [
      `Abono de ${origen.cliente_nombre}`,
      `orden: ${origen.orden_descripcion}`,
      formatoFechaHora(origen.fecha),
      `cobrado por ${origen.cobrado_por}`,
    ].join(' · ')
  }
  return `Gasto: ${origen.concepto ?? ''}`
}

/** E-21: el resumen completo que repiten los diálogos de confirmar y anular (incluye el valor). */
export function resumenPagoParaDialogo(movimiento: Pick<MovimientoCaja, 'tipo' | 'concepto' | 'origen' | 'valor'>): string {
  return `${describirOrigenPago(movimiento)} · ${formatoMoneda(movimiento.valor)}`
}

import type { EstadoPago } from '../tipos/dominio'

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

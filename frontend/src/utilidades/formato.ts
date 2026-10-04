/**
 * A2 (F-17): formato de montos y fechas para MOSTRAR. Es solo presentación:
 * los payloads, los tipos de dominio y los campos de entrada no cambian, y
 * ningún valor formateado se envía al servidor (D22).
 *
 * Ejemplo en la cafetería: el servidor devuelve `total: 12500` y
 * `fecha: "2026-09-21T10:15:02-05:00"`; en pantalla se ve «$ 12.500» y
 * «21/09/2026, 10:15 a. m.».
 */

const ZONA_HORARIA = 'America/Bogota'

const MONEDA = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HORARIA,
  dateStyle: 'medium',
  timeStyle: 'short',
})

// Para fechas SIN hora: se arma el día a mediodía UTC y se formatea en UTC,
// así ninguna zona horaria lo corre al día anterior.
const FECHA_SIN_HORA = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', dateStyle: 'medium' })

// 'en-CA' produce AAAA-MM-DD, el formato que esperan los <input type="date">.
const AAAA_MM_DD_BOGOTA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Monto en pesos colombianos: 3500 → «$ 3.500»; 3500.5 → «$ 3.500,5». */
export function formatoMoneda(valor: number | string): string {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(numero)) return String(valor)
  return MONEDA.format(numero)
}

/** Fecha y hora ISO del servidor, mostrada en hora de Bogotá. */
export function formatoFechaHora(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return FECHA_HORA.format(fecha)
}

/**
 * Fecha SIN hora ('AAAA-MM-DD', p. ej. fecha_entrega_estimada). No usa
 * `new Date('AAAA-MM-DD')`, que la interpreta como medianoche UTC y en
 * Bogotá mostraría el día anterior.
 */
export function formatoFecha(aaaa_mm_dd: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(aaaa_mm_dd)
  if (!partes) return aaaa_mm_dd
  const [, anio, mes, dia] = partes
  return FECHA_SIN_HORA.format(new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia), 12)))
}

/** 'AAAA-MM-DD' de hoy en Bogotá (no en UTC: de 19:00 a 23:59 serían días distintos). */
export function fechaHoyBogota(ahora: Date = new Date()): string {
  return AAAA_MM_DD_BOGOTA.format(ahora)
}

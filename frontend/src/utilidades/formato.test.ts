import { describe, expect, it } from 'vitest'
import { fechaHoyBogota, formatoFecha, formatoFechaHora, formatoMoneda } from './formato'

/** Intl usa espacios no separables; se normalizan para comparar. */
function normal(texto: string): string {
  return texto.replace(/\s/g, ' ')
}

describe('A2: formato de moneda', () => {
  it('formatea pesos colombianos sin decimales innecesarios', () => {
    expect(normal(formatoMoneda(3500))).toBe('$ 3.500')
    expect(normal(formatoMoneda(1250000))).toBe('$ 1.250.000')
  })

  it('conserva hasta dos decimales y acepta montos como texto', () => {
    expect(normal(formatoMoneda(3500.5))).toBe('$ 3.500,5')
    expect(normal(formatoMoneda('12500.75'))).toBe('$ 12.500,75')
  })

  it('muestra el valor tal cual si no es un número', () => {
    expect(formatoMoneda('abc')).toBe('abc')
  })
})

describe('A2: formato de fechas', () => {
  it('muestra una fecha ISO del servidor en hora de Bogotá', () => {
    expect(normal(formatoFechaHora('2026-09-21T10:15:02-05:00'))).toBe('21/09/2026, 10:15 a. m.')
  })

  it('convierte a Bogotá una hora que llega en UTC', () => {
    // 03:30 UTC del 22 = 22:30 del 21 en Bogotá.
    expect(normal(formatoFechaHora('2026-09-22T03:30:00Z'))).toBe('21/09/2026, 10:30 p. m.')
  })

  it('una fecha sin hora no se corre al día anterior', () => {
    // es-CO medium = día/mes/año. Con new Date('2026-10-01') saldría 30/09/2026.
    expect(normal(formatoFecha('2026-10-01'))).toMatch(/^0?1\/10\/2026$/)
  })

  it('fechaHoyBogota usa el día de Bogotá cerca de la medianoche UTC', () => {
    // 02:00 UTC del 4 de octubre = 21:00 del 3 de octubre en Bogotá.
    expect(fechaHoyBogota(new Date('2026-10-04T02:00:00Z'))).toBe('2026-10-03')
    // 05:00 UTC del 4 = medianoche exacta del 4 en Bogotá.
    expect(fechaHoyBogota(new Date('2026-10-04T05:00:00Z'))).toBe('2026-10-04')
  })
})

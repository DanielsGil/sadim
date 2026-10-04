import { describe, expect, it } from 'vitest'
import { ETIQUETA_ESTADO_PAGO, etiquetaMovimientoInventario, etiquetaRecursoSync } from './etiquetas'

describe('A6/A7: etiquetas legibles', () => {
  it('estado_pago tiene las tres etiquetas, incluido ANULADO', () => {
    expect(ETIQUETA_ESTADO_PAGO.ANULADO).toBe('Anulado')
    expect(ETIQUETA_ESTADO_PAGO.PENDIENTE_VERIFICACION).toBe('Pendiente de verificación')
  })

  it('el ajuste manual se etiqueta según su sentido', () => {
    expect(etiquetaMovimientoInventario({ tipo: 'AJUSTE_MANUAL', sentido: 'SUMA' })).toBe('Ajuste manual (suma)')
    expect(etiquetaMovimientoInventario({ tipo: 'AJUSTE_MANUAL', sentido: 'RESTA' })).toBe('Ajuste manual (resta)')
    expect(etiquetaMovimientoInventario({ tipo: 'SALIDA_SERVICIO', sentido: null })).toBe('Salida por orden de trabajo')
  })

  it('un recurso de sincronización sin etiqueta se muestra tal cual', () => {
    expect(etiquetaRecursoSync('ventas.cerrar')).toBe('Cobro de cuenta de mesa')
    expect(etiquetaRecursoSync('categorias')).toBe('categorias')
  })
})

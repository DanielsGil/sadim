import { describe, expect, it } from 'vitest'
import {
  ETIQUETA_ESTADO_PAGO,
  describirOrigenPago,
  etiquetaMovimientoInventario,
  etiquetaRecursoSync,
  resumenPagoParaDialogo,
} from './etiquetas'

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

describe('E-21: origen de un pago pendiente', () => {
  it('una venta de mesa muestra mesa, quién cobró, productos y valor', () => {
    const texto = resumenPagoParaDialogo({
      tipo: 'INGRESO_VENTA',
      concepto: null,
      valor: 9400,
      origen: {
        tipo: 'VENTA',
        venta_id: 'v1',
        venta_tipo: 'SESION_DINAMICA',
        mesa_numero: 3,
        descripcion: 'Mesa 3',
        fecha: '2026-10-06T14:32:00-05:00',
        cobrado_por: 'María',
        productos: [
          { nombre: 'Carne Arroz', cantidad: 2 },
          { nombre: 'Coca Cola 350', cantidad: 1 },
        ],
      },
    })
    expect(texto.startsWith('Mesa 3 · ')).toBe(true)
    expect(texto).toContain('cobrado por María · 2 Carne Arroz, 1 Coca Cola 350 · ')
    expect(texto).toContain('9.400')
  })

  it('un gasto sin origen (aún en la cola) usa su concepto', () => {
    expect(describirOrigenPago({ tipo: 'GASTO', concepto: 'Hielo' })).toBe('Hielo')
  })
})

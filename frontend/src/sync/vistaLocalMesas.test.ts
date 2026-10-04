import { describe, expect, it } from 'vitest'
import type { FilaOperacionLocal } from '../db/baseLocal'
import type { Mesa, Venta } from '../tipos/dominio'
import { construirMapaMesasLocal } from './vistaLocalMesas'

/** Datos en memoria (sin IndexedDB), como en motor.test.ts. */
function mesa(id: string, numero: number, estado: Mesa['estado'] = 'DISPONIBLE', activa = true): Mesa {
  return { id, operation_id: `op-${id}`, numero, activa, estado }
}

function fila(
  resource: string,
  action: FilaOperacionLocal['action'],
  id: string,
  creado_en: string,
  datos: Record<string, unknown>,
  referencia_id?: string,
): FilaOperacionLocal {
  return { operation_id: `op-${id}-${resource}`, resource, action, id, referencia_id, datos, creado_en }
}

const precioDe = (productoId: string) => (productoId === 'capuchino' ? 7500 : 3000)

describe('B4: mapa de mesas desde la copia local', () => {
  it('una sesión abierta sin conexión ocupa la mesa con su total provisional', () => {
    const mapa = construirMapaMesasLocal({
      mesas: [mesa('m3', 3), mesa('m1', 1)],
      ventasCopia: [],
      operaciones: [
        fila('ventas', 'CREATE', 'v1', '2026-10-03T10:00:00Z', { tipo: 'SESION_DINAMICA', mesa_id: 'm3' }),
        fila('ventas.detalles', 'CREATE', 'd1', '2026-10-03T10:00:01Z', { producto_id: 'capuchino', cantidad: 2 }, 'v1'),
      ],
      precioDe,
    })

    expect(mapa.mesas.map((m) => m.numero)).toEqual([1, 3])
    expect(mapa.mesas.find((m) => m.id === 'm3')?.estado).toBe('OCUPADA')
    expect(mapa.ventasAbiertas).toHaveLength(1)
    expect(mapa.ventasAbiertas[0].total).toBe(15000)
  })

  it('aplica sobre la copia del servidor: precio del dispositivo, quitar línea y cobro', () => {
    const copia: Venta = {
      id: 'v-servidor',
      operation_id: 'op-v',
      tipo: 'SESION_DINAMICA',
      estado: 'ABIERTA',
      mesa_id: 'm1',
      fecha_apertura: '2026-10-03T09:00:00-05:00',
      fecha_cierre: null,
      medio_pago: null,
      estado_pago: null,
      total: 3000,
      detalles: [
        { id: 'd-srv', operation_id: 'op-d', venta_id: 'v-servidor', producto_id: 'galleta', cantidad: 1, precio_unitario: 3000, subtotal: 3000 },
      ],
    }
    const mapa = construirMapaMesasLocal({
      mesas: [mesa('m1', 1, 'OCUPADA'), mesa('m2', 2, 'OCUPADA')],
      ventasCopia: [
        copia,
        { ...copia, id: 'v-m2', mesa_id: 'm2', total: 9000, detalles: [] },
      ],
      operaciones: [
        // El dispositivo encoló con su propio precio (D19): manda sobre el catálogo.
        fila('ventas.detalles', 'CREATE', 'd2', '2026-10-03T10:00:00Z', { producto_id: 'capuchino', cantidad: 1, precio_unitario: 8000 }, 'v-servidor'),
        fila('ventas.detalles', 'DELETE', 'd-srv', '2026-10-03T10:00:01Z', { id: 'd-srv' }, 'v-servidor'),
        fila('ventas.cerrar', 'UPDATE', 'v-m2', '2026-10-03T10:00:02Z', { medio_pago: 'EFECTIVO' }, 'v-m2'),
      ],
      precioDe,
    })

    const v1 = mapa.ventasAbiertas.find((v) => v.id === 'v-servidor')
    expect(v1?.total).toBe(8000)
    expect(mapa.ventasAbiertas.some((v) => v.id === 'v-m2')).toBe(false)
    expect(mapa.mesas.find((m) => m.id === 'm2')?.estado).toBe('DISPONIBLE')
    expect(mapa.mesas.find((m) => m.id === 'm1')?.estado).toBe('OCUPADA')
  })

  it('no muestra mesas inactivas y conserva el total del servidor si nada cambió', () => {
    const mapa = construirMapaMesasLocal({
      mesas: [mesa('m1', 1, 'OCUPADA'), mesa('m9', 9, 'DISPONIBLE', false)],
      ventasCopia: [
        {
          id: 'v1', operation_id: 'op', tipo: 'SESION_DINAMICA', estado: 'ABIERTA', mesa_id: 'm1',
          fecha_apertura: '2026-10-03T09:00:00-05:00', fecha_cierre: null, medio_pago: null,
          estado_pago: null, total: 12500, detalles: [],
        },
      ],
      operaciones: [],
      precioDe,
    })
    expect(mapa.mesas.map((m) => m.id)).toEqual(['m1'])
    expect(mapa.ventasAbiertas[0].total).toBe(12500)
  })
})

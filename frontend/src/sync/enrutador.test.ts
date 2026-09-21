import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OperacionCola } from '../tipos/dominio'

// Estado compartido con las fábricas de vi.mock (que se elevan sobre los imports).
const estado = vi.hoisted(() => ({
  enLinea: true,
  cola: [] as Array<{ operation_id: string; resource: string; action: string; payload: Record<string, unknown> }>,
  locales: [] as Array<{ operation_id: string; resource: string; id: string; referencia_id?: string }>,
}))

vi.mock('./cacheCatalogo', () => ({
  estaEnLinea: () => estado.enLinea,
  cachearCatalogo: vi.fn(),
  leerCatalogoLocal: vi.fn(async () => []),
  leerUnoDelCatalogoLocal: vi.fn(),
  parchearCatalogoLocal: vi.fn(),
}))

vi.mock('./almacenDexie', () => ({
  almacenColaDexie: {
    listarOrdenadas: async () => [...estado.cola],
    agregar: async (operacion: OperacionCola) => {
      estado.cola.push(operacion)
    },
    quitar: async () => {},
    incrementarIntentos: async () => {},
  },
  almacenNovedadesDexie: { agregar: vi.fn() },
}))

vi.mock('../db/baseLocal', () => ({
  baseLocal: {
    operaciones_locales: {
      put: async (fila: (typeof estado.locales)[number]) => {
        estado.locales.push(fila)
      },
    },
    cola_sincronizacion: {
      count: async () => estado.cola.length,
      toArray: async () => [...estado.cola],
    },
  },
  obtenerSesion: async () => ({ access_token: 'a', refresh_token: 'r', usuario_id: 'usuario-1', rol: 'ADMIN' }),
  guardarPropietarioColaSiFalta: vi.fn(),
  borrarPropietarioCola: vi.fn(),
  guardarCopiaLectura: vi.fn(),
}))

vi.mock('../api/cliente', () => ({ peticion: vi.fn(async () => ({})) }))
// Un error que no es ErrorEnvioLote: el motor lo trata como "sin red" y conserva la cola.
vi.mock('../api/sync', () => ({ enviarLoteSincronizacion: vi.fn().mockRejectedValue(new Error('sin red')) }))
vi.mock('./reconciliacion', () => ({ reconciliar: vi.fn() }))

// Las vistas locales leen Dexie; aquí solo interesa lo que se ENCOLA, no cómo se muestra.
vi.mock('./vistaLocalOrdenes', () => ({
  CLAVE_COPIA_ORDENES: 'ordenes',
  claveCopiaOrden: (id: string) => `orden:${id}`,
  claveCopiaConsumos: (id: string) => `consumos:${id}`,
  claveCopiaCostos: (id: string) => `costos:${id}`,
  descontarConsumosDelCatalogoLocal: vi.fn(),
  listarConsumosLocal: vi.fn(async () => []),
  listarOrdenesLocal: vi.fn(async () => []),
  obtenerCostosLocal: vi.fn(),
  obtenerOrdenLocal: vi.fn(async (id: string) => ({
    id,
    estado: 'RECIBIDO',
    saldo_pendiente: 80000,
    abonos: [],
  })),
}))

import { peticion } from '../api/cliente'
import { registrarGasto } from '../api/caja'
import { cambiarEstadoOrden, crearOrden, registrarAbono, registrarConsumo } from '../api/ordenesTrabajo'

const datosOrden = {
  cliente_nombre: 'Ana Torres',
  descripcion: 'Torta de cumpleaños',
  fecha_entrega_estimada: '2026-10-01',
  costo_total: 80000,
}

beforeEach(() => {
  estado.enLinea = true
  estado.cola.length = 0
  estado.locales.length = 0
  vi.mocked(peticion).mockClear()
})

describe('ruteo de órdenes de trabajo (HU-030, D17)', () => {
  it('sin conexión, crear una orden la encola con el id generado en el cliente y no llama al servidor', async () => {
    estado.enLinea = false

    await crearOrden(datosOrden)

    expect(peticion).not.toHaveBeenCalled()
    expect(estado.cola).toHaveLength(1)
    const operacion = estado.cola[0]
    expect(operacion.resource).toBe('ordenes-trabajo')
    expect(operacion.action).toBe('CREATE')
    expect(typeof operacion.payload.id).toBe('string')
    expect(operacion.payload.costo_total).toBe(80000)
    // D22: el saldo lo calcula el servidor, el cliente nunca lo envía.
    expect(operacion.payload).not.toHaveProperty('saldo_pendiente')
    expect(estado.locales[0].id).toBe(operacion.payload.id)
  })

  it('con conexión y cola vacía, cambiar el estado llama al endpoint en línea', async () => {
    await cambiarEstadoOrden('orden-1', 'EN_PROCESO')

    expect(estado.cola).toHaveLength(0)
    expect(peticion).toHaveBeenCalledTimes(1)
    const [ruta, opciones] = vi.mocked(peticion).mock.calls[0] as unknown as [string, { method: string; body: string }]
    expect(ruta).toBe('/ordenes-trabajo/orden-1/estado/')
    expect(opciones.method).toBe('PATCH')
    expect(JSON.parse(opciones.body)).toMatchObject({ estado: 'EN_PROCESO' })
  })

  it('con conexión pero con cola no vacía, un abono se encola para preservar el orden', async () => {
    estado.cola.push({ operation_id: 'op-previa', resource: 'ventas', action: 'CREATE', payload: {} })

    const abono = await registrarAbono('orden-1', 30000, 'EFECTIVO')

    expect(peticion).not.toHaveBeenCalled()
    expect(estado.cola.map((op) => op.resource)).toEqual(['ventas', 'ordenes-trabajo.abonos'])
    expect(estado.cola[1].payload).toMatchObject({ orden_id: 'orden-1', valor: 30000, medio_pago: 'EFECTIVO' })
    expect(abono.estado_pago).toBe('CONFIRMADO')
  })

  it('un abono por TRANSFERENCIA sin conexión nunca se muestra como confirmado', async () => {
    estado.enLinea = false

    const abono = await registrarAbono('orden-1', 10000, 'TRANSFERENCIA')

    expect(abono.estado_pago).toBe('PENDIENTE_VERIFICACION')
  })

  it('crear orden, abonar, consumir y avanzar sin conexión queda en orden y referencia la orden creada offline', async () => {
    estado.enLinea = false

    const orden = await crearOrden(datosOrden)
    await registrarAbono(orden.id, 20000, 'EFECTIVO')
    await registrarConsumo(orden.id, 'producto-1', 2)
    await cambiarEstadoOrden(orden.id, 'EN_PROCESO')

    expect(estado.cola.map((op) => op.resource)).toEqual([
      'ordenes-trabajo',
      'ordenes-trabajo.abonos',
      'ordenes-trabajo.consumos',
      'ordenes-trabajo.estado',
    ])
    expect(estado.cola[0].payload.id).toBe(orden.id)
    for (const operacion of estado.cola.slice(1)) {
      expect(operacion.payload.orden_id).toBe(orden.id)
    }
    expect(estado.cola[3].payload.estado).toBe('EN_PROCESO')
    expect(peticion).not.toHaveBeenCalled()
  })
})

describe('ruteo de gastos de caja (HU-030, D17)', () => {
  it('sin conexión, un gasto en efectivo se encola como movimientos-caja CREATE de tipo GASTO, confirmado', async () => {
    estado.enLinea = false

    const gasto = await registrarGasto('EFECTIVO', 12000, 'Compra de bolsas')

    expect(peticion).not.toHaveBeenCalled()
    expect(estado.cola).toHaveLength(1)
    expect(estado.cola[0].resource).toBe('movimientos-caja')
    expect(estado.cola[0].action).toBe('CREATE')
    expect(estado.cola[0].payload).toMatchObject({
      tipo: 'GASTO',
      medio_pago: 'EFECTIVO',
      valor: 12000,
      concepto: 'Compra de bolsas',
    })
    expect(gasto.estado_pago).toBe('CONFIRMADO')
  })

  it('un gasto por QR sin conexión queda pendiente de verificación, nunca confirmado', async () => {
    estado.enLinea = false

    const gasto = await registrarGasto('QR', 5000, 'Domicilio')

    expect(gasto.estado_pago).toBe('PENDIENTE_VERIFICACION')
    expect(gasto.fecha_confirmacion).toBeNull()
  })

  it('con conexión y cola vacía, el gasto se registra en línea', async () => {
    await registrarGasto('EFECTIVO', 12000, 'Compra de bolsas')

    expect(estado.cola).toHaveLength(0)
    const [ruta, opciones] = vi.mocked(peticion).mock.calls[0] as unknown as [string, { method: string; body: string }]
    expect(ruta).toBe('/movimientos-caja/')
    expect(JSON.parse(opciones.body)).toMatchObject({ tipo: 'GASTO', medio_pago: 'EFECTIVO', valor: 12000 })
  })

  it('con conexión pero con cola no vacía, el gasto se encola para no adelantarse a lo pendiente', async () => {
    estado.cola.push({ operation_id: 'op-previa', resource: 'ventas.cerrar', action: 'UPDATE', payload: {} })

    await registrarGasto('EFECTIVO', 3000, 'Hielo')

    expect(peticion).not.toHaveBeenCalled()
    expect(estado.cola.map((op) => op.resource)).toEqual(['ventas.cerrar', 'movimientos-caja'])
  })
})

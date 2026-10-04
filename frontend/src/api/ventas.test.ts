import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * B3 (F-9, D19): el payload que se ENCOLA lleva precio_unitario (el de la
 * copia local del catálogo); la llamada en línea no lo envía. Se reemplazan
 * el enrutador, la copia local y el cliente HTTP por dobles en memoria, así
 * la prueba no necesita IndexedDB.
 */
const capturadas: Array<{ resource: string; payload: Record<string, unknown>; enLinea: () => Promise<unknown> }> = []
const cuerposEnLinea: Array<Record<string, unknown>> = []

vi.mock('../sync/enrutador', () => ({
  escribir: vi.fn(async (opciones: {
    resource: string
    payload: Record<string, unknown>
    llamarEnLinea: (operationId: string) => Promise<unknown>
  }) => {
    capturadas.push({
      resource: opciones.resource,
      payload: opciones.payload,
      enLinea: () => opciones.llamarEnLinea('op-en-linea'),
    })
    return {}
  }),
}))

vi.mock('../sync/cacheCatalogo', () => ({
  estaEnLinea: () => false,
  parchearCatalogoLocal: vi.fn(),
  leerUnoDelCatalogoLocal: vi.fn(async (_recurso: string, id: string) =>
    id === 'prod-capuchino' ? { id, precio_venta: 7500 } : undefined,
  ),
}))

vi.mock('../sync/vistaLocalVentas', () => ({
  buscarVentaLocalPorMesa: vi.fn(),
  obtenerVentaLocal: vi.fn(),
}))

vi.mock('./cliente', () => ({
  peticion: vi.fn(async (_ruta: string, opciones?: { body?: string }) => {
    if (opciones?.body) cuerposEnLinea.push(JSON.parse(opciones.body))
    return {}
  }),
}))

const { agregarDetalle, crearVentaRapida } = await import('./ventas')

describe('B3: precio del dispositivo en la cola de sincronización', () => {
  beforeEach(() => {
    capturadas.length = 0
    cuerposEnLinea.length = 0
  })

  it('ventas.detalles CREATE encolado lleva precio_unitario; en línea no', async () => {
    await agregarDetalle('venta-1', 'prod-capuchino', 2)

    const operacion = capturadas[0]
    expect(operacion.resource).toBe('ventas.detalles')
    expect(operacion.payload.precio_unitario).toBe(7500)
    expect(operacion.payload).not.toHaveProperty('subtotal')

    await operacion.enLinea()
    expect(cuerposEnLinea[0]).not.toHaveProperty('precio_unitario')
  })

  it('ventas CREATE (RAPIDA) encolada lleva precio_unitario en cada detalle', async () => {
    await crearVentaRapida('EFECTIVO', [
      { producto_id: 'prod-capuchino', cantidad: 3 },
      { producto_id: 'prod-sin-copia-local', cantidad: 1 },
    ])

    const detalles = capturadas[0].payload.detalles as Array<Record<string, unknown>>
    expect(capturadas[0].resource).toBe('ventas')
    expect(detalles[0].precio_unitario).toBe(7500)
    // Sin copia local del producto se omite: el servidor usa el precio vigente.
    expect(detalles[1]).not.toHaveProperty('precio_unitario')
    expect(capturadas[0].payload).not.toHaveProperty('total')

    await capturadas[0].enLinea()
    const enLinea = cuerposEnLinea[0].detalles as Array<Record<string, unknown>>
    expect(enLinea[0]).not.toHaveProperty('precio_unitario')
  })
})

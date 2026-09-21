import { v4 as uuidv4 } from 'uuid'
import { guardarCopiaLectura, obtenerSesion } from '../db/baseLocal'
import type { MovimientoInventario } from '../tipos/dominio'
import { estaEnLinea } from '../sync/cacheCatalogo'
import { escribir } from '../sync/enrutador'
import { hayPendientesDe } from '../sync/pendientes'
import {
  ajustarStockLocal,
  claveCopiaMovimientos,
  listarMovimientosLocal,
} from '../sync/vistaLocalInventarioCaja'
import { peticion } from './cliente'

// Contrato API v2 §9 (HU-025, HU-026). ENTRADA es de ambos roles; MERMA y
// AJUSTE_MANUAL exigen ADMIN (el backend responde 403 PERMISO_INSUFICIENTE si
// no, tanto en línea como al sincronizar). Toda escritura pasa por
// sync/enrutador (HU-030, D17): en cola, el stock que se muestra es
// provisional (D22) y el servidor lo recalcula al sincronizar.

export async function listarMovimientos(productoId?: string): Promise<MovimientoInventario[]> {
  const cadena = productoId ? `?producto=${productoId}` : ''
  if (await hayPendientesDe('inventario.movimientos')) {
    const local = await listarMovimientosLocal(productoId)
    if (local.length > 0) return local
  }
  try {
    const movimientos = await peticion<MovimientoInventario[]>(`/inventario/movimientos/${cadena}`)
    await guardarCopiaLectura(claveCopiaMovimientos(productoId), movimientos)
    return movimientos
  } catch (error) {
    if (estaEnLinea()) throw error
    return listarMovimientosLocal(productoId)
  }
}

interface DatosMovimiento {
  productoId: string
  tipo: 'ENTRADA' | 'MERMA' | 'AJUSTE_MANUAL'
  cantidad: number
  motivo: string
  sentido?: 'SUMA' | 'RESTA'
}

function registrarMovimiento(datos: DatosMovimiento): Promise<MovimientoInventario> {
  const idMovimiento = uuidv4()
  const cuerpo = {
    producto_id: datos.productoId,
    tipo: datos.tipo,
    ...(datos.sentido ? { sentido: datos.sentido } : {}),
    cantidad: datos.cantidad,
    motivo: datos.motivo,
  }
  const resta = datos.tipo === 'MERMA' || (datos.tipo === 'AJUSTE_MANUAL' && datos.sentido === 'RESTA')

  return escribir<MovimientoInventario>({
    resource: 'inventario.movimientos',
    action: 'CREATE',
    idObjeto: idMovimiento,
    payload: { id: idMovimiento, ...cuerpo },
    llamarEnLinea: (operationId) =>
      peticion<MovimientoInventario>('/inventario/movimientos/', {
        method: 'POST',
        body: JSON.stringify({ operation_id: operationId, ...cuerpo }),
      }),
    reflejarLocal: async (operationId) => {
      await ajustarStockLocal(datos.productoId, resta ? -datos.cantidad : datos.cantidad)
      const sesion = await obtenerSesion()
      return {
        id: idMovimiento,
        operation_id: operationId,
        producto_id: datos.productoId,
        usuario_id: sesion?.usuario_id ?? '',
        venta_id: null,
        tipo: datos.tipo,
        cantidad: datos.cantidad,
        sentido: datos.sentido ?? null,
        fecha: new Date().toISOString(),
        motivo: datos.motivo,
      }
    },
  })
}

export function registrarEntrada(productoId: string, cantidad: number, motivo: string): Promise<MovimientoInventario> {
  return registrarMovimiento({ productoId, tipo: 'ENTRADA', cantidad, motivo })
}

export function registrarMerma(productoId: string, cantidad: number, motivo: string): Promise<MovimientoInventario> {
  return registrarMovimiento({ productoId, tipo: 'MERMA', cantidad, motivo })
}

export function registrarAjusteManual(
  productoId: string,
  sentido: 'SUMA' | 'RESTA',
  cantidad: number,
  motivo: string,
): Promise<MovimientoInventario> {
  return registrarMovimiento({ productoId, tipo: 'AJUSTE_MANUAL', sentido, cantidad, motivo })
}

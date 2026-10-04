import { baseLocal, type FilaOperacionLocal } from '../db/baseLocal'
import type { DetalleVenta, Mesa, Producto, Venta } from '../tipos/dominio'
import { leerCatalogoLocal } from './cacheCatalogo'

export const CLAVE_VENTAS_ABIERTAS = 'ventas_abiertas'

export interface MapaMesas {
  mesas: Mesa[]
  ventasAbiertas: Venta[]
}

interface EntradaMapaLocal {
  /** Mesas de la copia local del catálogo (almacén `catalogo`). */
  mesas: Mesa[]
  /** Última copia de ventas ABIERTAS del servidor (meta.ventas_abiertas). */
  ventasCopia: Venta[]
  /** Operaciones de ventas que SIGUEN en la cola, en orden de creación. */
  operaciones: FilaOperacionLocal[]
  /** precio_venta de la copia local del catálogo, si el payload no trae precio. */
  precioDe: (productoId: string) => number
}

/**
 * B4 (F-1): mapa de mesas SOLO para mostrar sin conexión o con cola pendiente
 * (D22: todo es provisional). Parte de la última copia del servidor y le
 * aplica, en orden, las operaciones que este dispositivo aún no sincroniza:
 * abrir sesión, agregar/quitar producto, cobrar y cancelar. Función pura,
 * para poder probarla sin IndexedDB.
 *
 * Ejemplo: la copia dice que la Mesa 3 está libre; sin conexión el mesero abre
 * la cuenta y agrega 2 capuchinos de $ 7.500 → la Mesa 3 sale «Ocupada» con
 * «Total: $ 15.000» provisional.
 */
export function construirMapaMesasLocal(entrada: EntradaMapaLocal): MapaMesas {
  const abiertas = new Map<string, Venta>()
  for (const venta of entrada.ventasCopia) {
    if (venta.estado === 'ABIERTA' && venta.mesa_id) {
      abiertas.set(venta.id, { ...venta, detalles: [...venta.detalles] })
    }
  }
  const tocadas = new Set<string>()
  const mesasLiberadas = new Set<string>()

  const ordenadas = [...entrada.operaciones].sort((a, b) => a.creado_en.localeCompare(b.creado_en))
  for (const fila of ordenadas) {
    const datos = fila.datos as Record<string, unknown>
    if (fila.resource === 'ventas' && fila.action === 'CREATE') {
      if (datos.tipo !== 'SESION_DINAMICA' || abiertas.has(fila.id)) continue
      abiertas.set(fila.id, {
        id: fila.id,
        operation_id: fila.operation_id,
        tipo: 'SESION_DINAMICA',
        estado: 'ABIERTA',
        mesa_id: String(datos.mesa_id),
        fecha_apertura: fila.creado_en,
        fecha_cierre: null,
        medio_pago: null,
        estado_pago: null,
        total: 0,
        detalles: [],
      })
      continue
    }

    const venta = fila.referencia_id ? abiertas.get(fila.referencia_id) : undefined
    if (!venta) continue
    if (fila.resource === 'ventas.detalles' && fila.action === 'CREATE') {
      const productoId = String(datos.producto_id)
      const cantidad = Number(datos.cantidad)
      const precio = datos.precio_unitario != null ? Number(datos.precio_unitario) : entrada.precioDe(productoId)
      const detalle: DetalleVenta = {
        id: fila.id,
        operation_id: fila.operation_id,
        venta_id: venta.id,
        producto_id: productoId,
        cantidad,
        precio_unitario: precio,
        subtotal: precio * cantidad,
      }
      venta.detalles.push(detalle)
      tocadas.add(venta.id)
    } else if (fila.resource === 'ventas.detalles' && fila.action === 'DELETE') {
      venta.detalles = venta.detalles.filter((detalle) => detalle.id !== fila.id)
      tocadas.add(venta.id)
    } else if (fila.resource === 'ventas.cerrar' || fila.resource === 'ventas.cancelar') {
      if (venta.mesa_id) mesasLiberadas.add(venta.mesa_id)
      abiertas.delete(venta.id)
    }
  }

  // Total provisional solo de las cuentas que cambiaron en este dispositivo;
  // las demás conservan el total que calculó el servidor.
  for (const id of tocadas) {
    const venta = abiertas.get(id)
    if (venta) venta.total = venta.detalles.reduce((suma, detalle) => suma + Number(detalle.subtotal), 0)
  }

  const ventasAbiertas = [...abiertas.values()]
  const mesas = entrada.mesas
    .filter((mesa) => mesa.activa)
    .map((mesa) => {
      const ocupada = ventasAbiertas.some((venta) => venta.mesa_id === mesa.id)
      const estado: Mesa['estado'] = ocupada ? 'OCUPADA' : mesasLiberadas.has(mesa.id) ? 'DISPONIBLE' : mesa.estado
      return { ...mesa, estado }
    })
    .sort((a, b) => a.numero - b.numero)

  return { mesas, ventasAbiertas }
}

/** Lee de IndexedDB todo lo que necesita construirMapaMesasLocal. */
export async function leerMapaMesasLocal(): Promise<MapaMesas> {
  const [mesas, productos, filaCopia, cola, operaciones] = await Promise.all([
    leerCatalogoLocal<Mesa>('mesas'),
    leerCatalogoLocal<Producto>('productos'),
    baseLocal.meta.get(CLAVE_VENTAS_ABIERTAS),
    baseLocal.cola_sincronizacion.toArray(),
    baseLocal.operaciones_locales.where('resource').startsWith('ventas').toArray(),
  ])
  const enCola = new Set(cola.map((operacion) => operacion.operation_id))
  const precios = new Map(productos.map((producto) => [producto.id, Number(producto.precio_venta)]))
  return construirMapaMesasLocal({
    mesas,
    ventasCopia: (filaCopia?.valor as Venta[] | undefined) ?? [],
    operaciones: operaciones.filter((fila) => enCola.has(fila.operation_id)),
    precioDe: (productoId) => precios.get(productoId) ?? 0,
  })
}

/** Guarda la última lista de ventas abiertas que devolvió el servidor. */
export async function guardarVentasAbiertasLocal(ventas: Venta[]): Promise<void> {
  await baseLocal.meta.put({ clave: CLAVE_VENTAS_ABIERTAS, valor: ventas })
}

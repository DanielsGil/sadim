import type { Categoria, Producto, TipoProducto } from '../tipos/dominio'
import { cachearCatalogo, estaEnLinea, leerCatalogoLocal } from '../sync/cacheCatalogo'
import { peticion } from './cliente'

// Contrato API §5/§6. Rutas y nombres de campos exactos (incluye
// categoria_id, no categoria). Las lecturas se cachean en Dexie (ERD §10,
// almacén "catalogo") para poder mostrarlas sin conexión (HU-030/HU-046).

export async function listarCategorias(): Promise<Categoria[]> {
  try {
    const categorias = await peticion<Categoria[]>('/categorias/')
    await cachearCatalogo('categorias', categorias)
    return categorias
  } catch (error) {
    if (estaEnLinea()) throw error
    return leerCatalogoLocal<Categoria>('categorias')
  }
}

export function crearCategoria(nombre: string): Promise<Categoria> {
  return peticion<Categoria>('/categorias/', {
    method: 'POST',
    body: JSON.stringify({ nombre }),
  })
}

export function editarCategoria(id: string, nombre: string): Promise<Categoria> {
  return peticion<Categoria>(`/categorias/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ nombre }),
  })
}

export interface FiltrosProductos {
  categoriaId?: string
  tipo?: TipoProducto
}

export async function listarProductos(filtros: FiltrosProductos = {}): Promise<Producto[]> {
  const parametros = new URLSearchParams()
  if (filtros.categoriaId) parametros.set('categoria', filtros.categoriaId)
  if (filtros.tipo) parametros.set('tipo', filtros.tipo)
  const cadena = parametros.toString()
  try {
    const productos = await peticion<Producto[]>(`/productos/${cadena ? `?${cadena}` : ''}`)
    await cachearCatalogo('productos', productos)
    return productos
  } catch (error) {
    if (estaEnLinea()) throw error
    const locales = await leerCatalogoLocal<Producto>('productos')
    return locales.filter(
      (producto) =>
        (!filtros.categoriaId || producto.categoria_id === filtros.categoriaId) &&
        (!filtros.tipo || producto.tipo === filtros.tipo),
    )
  }
}

export interface DatosProducto {
  categoria_id: string
  nombre: string
  tipo: TipoProducto
  precio_venta: number
  costo_produccion: number | null
  unidad_medida: string
  stock_minimo: number
  controla_stock: boolean
}

export function crearProducto(datos: DatosProducto): Promise<Producto> {
  return peticion<Producto>('/productos/', {
    method: 'POST',
    body: JSON.stringify(datos),
  })
}

export function editarProducto(id: string, datos: Partial<DatosProducto>): Promise<Producto> {
  return peticion<Producto>(`/productos/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  })
}

/** PATCH {activo}: baja lógica y reactivación (CU-05, D3). stock_actual nunca se envía. */
export function cambiarActivoProducto(id: string, activo: boolean): Promise<Producto> {
  return peticion<Producto>(`/productos/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ activo }),
  })
}

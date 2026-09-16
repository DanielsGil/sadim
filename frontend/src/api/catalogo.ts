import type { Categoria, Producto, TipoProducto } from '../tipos/dominio'
import { peticion } from './cliente'

// Contrato API §5/§6. Rutas y nombres de campos exactos (incluye
// categoria_id, no categoria).

export function listarCategorias(): Promise<Categoria[]> {
  return peticion<Categoria[]>('/categorias/')
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

export function listarProductos(filtros: FiltrosProductos = {}): Promise<Producto[]> {
  const parametros = new URLSearchParams()
  if (filtros.categoriaId) parametros.set('categoria', filtros.categoriaId)
  if (filtros.tipo) parametros.set('tipo', filtros.tipo)
  const cadena = parametros.toString()
  return peticion<Producto[]>(`/productos/${cadena ? `?${cadena}` : ''}`)
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

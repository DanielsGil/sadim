import { useMemo, useState } from 'react'
import type { Categoria, Producto } from '../tipos/dominio'

interface Props {
  categorias: Categoria[]
  productos: Producto[]
  onSeleccionar: (producto: Producto) => void
  /** E-10: unidades acumuladas por producto (clics aún sin enviar), para mostrarlas en la tarjeta. */
  acumulados?: Record<string, number>
}

/** Color de fondo derivado del id de la categoría (hash simple -> HSL). No
 * agrega ningún campo al modelo Categoria (E-07): es puramente visual. */
function colorCategoria(categoriaId: string): string {
  let hash = 0
  for (let i = 0; i < categoriaId.length; i += 1) {
    hash = (hash * 31 + categoriaId.charCodeAt(i)) >>> 0
  }
  const hue = hash % 360
  return `hsl(${hue}, 65%, 92%)`
}

/**
 * E-07 (Lote de correcciones 3): reemplaza el <select> de productos por
 * categorías + tarjetas + buscador. Compartido entre la venta rápida y el
 * detalle de sesión para no duplicar el criterio.
 */
export function SelectorProductos({ categorias, productos, onSeleccionar, acumulados = {} }: Props) {
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const categoriasConProductos = useMemo(
    () => categorias.filter((cat) => productos.some((p) => p.categoria_id === cat.id)),
    [categorias, productos],
  )

  const productosVisibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    if (termino) {
      return productos.filter((p) => p.nombre.toLowerCase().includes(termino))
    }
    if (categoriaId) {
      return productos.filter((p) => p.categoria_id === categoriaId)
    }
    return []
  }, [productos, busqueda, categoriaId])

  function nombreCategoria(id: string): string {
    return categorias.find((c) => c.id === id)?.nombre ?? ''
  }

  return (
    <div className="selector-productos">
      <input
        type="search"
        className="selector-productos-buscador"
        placeholder="Buscar producto por nombre…"
        value={busqueda}
        onChange={(evento) => setBusqueda(evento.target.value)}
        aria-label="Buscar producto"
      />

      {!busqueda && (
        <div className="lista-categorias selector-productos-categorias">
          {categoriasConProductos.map((categoria) => (
            <button
              key={categoria.id}
              type="button"
              className={`chip-categoria ${categoriaId === categoria.id ? 'chip-categoria-activa' : ''}`}
              style={{ background: colorCategoria(categoria.id) }}
              onClick={() => setCategoriaId(categoria.id === categoriaId ? null : categoria.id)}
            >
              {categoria.nombre}
            </button>
          ))}
          {categoriasConProductos.length === 0 && (
            <p className="texto-vacio">No hay categorías con productos activos.</p>
          )}
        </div>
      )}

      <div className="cuadricula-selector-productos">
        {productosVisibles.map((producto) => (
          <button
            key={producto.id}
            type="button"
            className="tarjeta-producto-selector"
            style={{ background: colorCategoria(producto.categoria_id) }}
            onClick={() => onSeleccionar(producto)}
          >
            {(acumulados[producto.id] ?? 0) > 0 && (
              <span className="tarjeta-producto-acumulado" aria-live="polite">
                +{acumulados[producto.id]}
              </span>
            )}
            <span className="tarjeta-producto-nombre">{producto.nombre}</span>
            <span className="tarjeta-producto-precio">{producto.precio_venta}</span>
            {producto.controla_stock && (
              <span className="tarjeta-producto-stock">Stock: {producto.stock_actual}</span>
            )}
          </button>
        ))}
        {productosVisibles.length === 0 && (
          <p className="texto-vacio">
            {busqueda
              ? 'Ningún producto coincide con la búsqueda.'
              : categoriaId
                ? `${nombreCategoria(categoriaId)} no tiene productos activos.`
                : 'Elige una categoría o busca un producto por nombre.'}
          </p>
        )}
      </div>
    </div>
  )
}

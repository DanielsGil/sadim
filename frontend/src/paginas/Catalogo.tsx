import { useEffect, useState } from 'react'
import { cambiarActivoProducto, listarCategorias, listarProductos } from '../api/catalogo'
import { ErrorApi } from '../api/errorApi'
import { FormularioCategoria } from '../componentes/FormularioCategoria'
import { FormularioProducto } from '../componentes/FormularioProducto'
import type { Categoria, Producto, TipoProducto } from '../tipos/dominio'
import { formatoMoneda } from '../utilidades/formato'

const ETIQUETA_TIPO: Record<TipoProducto, string> = {
  REVENTA_DIRECTA: 'Reventa directa',
  INSUMO_PRODUCCION: 'Insumo de producción',
}

/** Catálogo (CU-05) — solo ADMIN. El OPERADOR no tiene esta pantalla: su
 * consulta de productos llega con la venta rápida (HU-013). */
export function Catalogo() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [filtroCategoriaId, setFiltroCategoriaId] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoProducto | ''>('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formularioCategoria, setFormularioCategoria] = useState<'nueva' | Categoria | null>(
    null,
  )
  const [formularioProducto, setFormularioProducto] = useState<'nuevo' | Producto | null>(null)

  useEffect(() => {
    listarCategorias()
      .then(setCategorias)
      .catch((err: unknown) => {
        setError(err instanceof ErrorApi ? err.message : 'No se pudieron cargar las categorías.')
      })
  }, [])

  useEffect(() => {
    setCargando(true)
    setError(null)
    listarProductos({ categoriaId: filtroCategoriaId || undefined, tipo: filtroTipo || undefined })
      .then(setProductos)
      .catch((err: unknown) => {
        setError(err instanceof ErrorApi ? err.message : 'No se pudieron cargar los productos.')
      })
      .finally(() => setCargando(false))
  }, [filtroCategoriaId, filtroTipo])

  function recargarProductos() {
    listarProductos({ categoriaId: filtroCategoriaId || undefined, tipo: filtroTipo || undefined })
      .then(setProductos)
      .catch(() => {
        /* el error ya se mostró en el intento anterior; no interrumpe la UI */
      })
  }

  function nombreCategoria(categoriaId: string): string {
    return categorias.find((categoria) => categoria.id === categoriaId)?.nombre ?? '—'
  }

  async function alternarActivo(producto: Producto) {
    setError(null)
    try {
      const actualizado = await cambiarActivoProducto(producto.id, !producto.activo)
      setProductos((actuales) => actuales.map((p) => (p.id === actualizado.id ? actualizado : p)))
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar el estado del producto.')
    }
  }

  return (
    <div className="pagina-catalogo">
      <h1>Catálogo</h1>
      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      <section className="seccion-categorias">
        <div className="encabezado-seccion">
          <h2>Categorías</h2>
          <button type="button" onClick={() => setFormularioCategoria('nueva')}>
            Nueva categoría
          </button>
        </div>

        <ul className="lista-categorias">
          {categorias.map((categoria) => (
            <li key={categoria.id}>
              <span>{categoria.nombre}</span>
              <button
                type="button"
                className="boton-secundario"
                onClick={() => setFormularioCategoria(categoria)}
              >
                Editar
              </button>
            </li>
          ))}
          {categorias.length === 0 && <li className="texto-vacio">Todavía no hay categorías.</li>}
        </ul>

        {formularioCategoria && (
          <FormularioCategoria
            categoriaInicial={formularioCategoria === 'nueva' ? undefined : formularioCategoria}
            onCancelar={() => setFormularioCategoria(null)}
            onGuardado={(categoria) => {
              setCategorias((actuales) => {
                const existe = actuales.some((c) => c.id === categoria.id)
                return existe
                  ? actuales.map((c) => (c.id === categoria.id ? categoria : c))
                  : [...actuales, categoria]
              })
              setFormularioCategoria(null)
            }}
          />
        )}
      </section>

      <section className="seccion-productos">
        <div className="encabezado-seccion">
          <h2>Productos</h2>
          <button
            type="button"
            onClick={() => setFormularioProducto('nuevo')}
            disabled={categorias.length === 0}
            title={categorias.length === 0 ? 'Crea primero una categoría' : undefined}
          >
            Nuevo producto
          </button>
        </div>

        <div className="filtros-productos">
          <label htmlFor="filtro-categoria">Categoría</label>
          <select
            id="filtro-categoria"
            value={filtroCategoriaId}
            onChange={(evento) => setFiltroCategoriaId(evento.target.value)}
          >
            <option value="">Todas</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>

          <label htmlFor="filtro-tipo">Tipo</label>
          <select
            id="filtro-tipo"
            value={filtroTipo}
            onChange={(evento) => setFiltroTipo(evento.target.value as TipoProducto | '')}
          >
            <option value="">Todos</option>
            <option value="REVENTA_DIRECTA">Reventa directa</option>
            <option value="INSUMO_PRODUCCION">Insumo de producción</option>
          </select>
        </div>

        {cargando ? (
          <p className="cargando">Cargando productos…</p>
        ) : (
          <table className="tabla-productos">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Tipo</th>
                <th>Precio venta</th>
                <th>Costo producción</th>
                <th>Stock actual</th>
                <th>Stock mínimo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((producto) => (
                <tr key={producto.id} className={producto.activo ? '' : 'fila-inactiva'}>
                  <td>{producto.nombre}</td>
                  <td>{nombreCategoria(producto.categoria_id)}</td>
                  <td>{ETIQUETA_TIPO[producto.tipo]}</td>
                  <td>{formatoMoneda(producto.precio_venta)}</td>
                  <td>{producto.costo_produccion != null ? formatoMoneda(producto.costo_produccion) : '—'}</td>
                  <td>{producto.controla_stock ? producto.stock_actual : '—'}</td>
                  <td>{producto.controla_stock ? producto.stock_minimo : '—'}</td>
                  <td>
                    <span className={producto.activo ? 'insignia-activo' : 'insignia-inactivo'}>
                      {producto.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="celda-acciones">
                    <button
                      type="button"
                      className="boton-secundario"
                      onClick={() => setFormularioProducto(producto)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="boton-secundario"
                      onClick={() => alternarActivo(producto)}
                    >
                      {producto.activo ? 'Desactivar' : 'Reactivar'}
                    </button>
                  </td>
                </tr>
              ))}
              {productos.length === 0 && (
                <tr>
                  <td colSpan={9} className="texto-vacio">
                    Ningún producto coincide con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {formularioProducto && (
          <FormularioProducto
            categorias={categorias}
            productoInicial={formularioProducto === 'nuevo' ? undefined : formularioProducto}
            onCancelar={() => setFormularioProducto(null)}
            onGuardado={() => {
              setFormularioProducto(null)
              recargarProductos()
            }}
          />
        )}
      </section>
    </div>
  )
}

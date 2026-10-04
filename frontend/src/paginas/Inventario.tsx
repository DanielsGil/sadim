import { useEffect, useState } from 'react'
import { listarCategorias } from '../api/catalogo'
import { mensajeErrorApi } from '../api/errorApi'
import { listarMovimientos } from '../api/inventarioMovimientos'
import { listarStock } from '../api/inventarioStock'
import { AvisoCopiaLocal, EtiquetaProvisional } from '../componentes/AvisoLocal'
import { PanelMovimientoInventario } from '../componentes/PanelMovimientoInventario'
import { useSesion } from '../contexto/SesionContext'
import { useEstadoLocal } from '../sync/useEstadoLocal'
import type { Categoria, MovimientoInventario, StockProducto } from '../tipos/dominio'
import { etiquetaMovimientoInventario } from '../utilidades/etiquetas'
import { formatoFechaHora } from '../utilidades/formato'

/**
 * Inventario (CU-11, CU-12, CU-13, HU-024, HU-025, HU-026): existencias,
 * historial y movimientos en una sola pantalla (E-13). Escritorio: tabla a
 * la izquierda y panel de movimiento a la derecha; celular: la tabla ocupa
 * la pantalla y «Registrar movimiento» abre el panel en una hoja.
 */
export function Inventario() {
  const { sesion } = useSesion()
  const esAdmin = sesion?.rol === 'ADMIN'
  const { enLinea, provisional } = useEstadoLocal()

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [stock, setStock] = useState<StockProducto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [productoSeleccionado, setProductoSeleccionado] = useState<StockProducto | null>(null)
  const [historial, setHistorial] = useState<MovimientoInventario[]>([])
  const [hojaAbierta, setHojaAbierta] = useState(false)

  useEffect(() => {
    listarCategorias().then(setCategorias)
  }, [])

  function recargarStock() {
    setCargando(true)
    setError(null)
    listarStock(filtroCategoria || undefined, filtroTipo || undefined)
      .then(setStock)
      .catch((err: unknown) => {
        setError(mensajeErrorApi(err, 'No se pudo cargar el stock.'))
      })
      .finally(() => setCargando(false))
  }

  useEffect(recargarStock, [filtroCategoria, filtroTipo])

  /** Clic en una fila: muestra su historial y lo precarga en el panel de movimiento. */
  function seleccionarProducto(producto: StockProducto) {
    setProductoSeleccionado(producto)
    listarMovimientos(producto.id).then(setHistorial)
  }

  function alRegistrar(productoId: string) {
    recargarStock()
    if (productoSeleccionado?.id === productoId) {
      listarMovimientos(productoId).then(setHistorial)
    }
  }

  return (
    <div className="pagina-inventario">
      <div className="encabezado-seccion">
        <h1>Inventario</h1>
        <button type="button" className="boton-abrir-movimiento" onClick={() => setHojaAbierta(true)}>
          Registrar movimiento
        </button>
      </div>

      <div className="inventario-columnas">
        <div className="inventario-existencias">
          <div className="filtros-productos">
            <label htmlFor="inventario-filtro-categoria">Categoría</label>
            <select
              id="inventario-filtro-categoria"
              value={filtroCategoria}
              onChange={(evento) => setFiltroCategoria(evento.target.value)}
            >
              <option value="">Todas</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
              ))}
            </select>

            <label htmlFor="inventario-filtro-tipo">Tipo</label>
            <select
              id="inventario-filtro-tipo"
              value={filtroTipo}
              onChange={(evento) => setFiltroTipo(evento.target.value)}
            >
              <option value="">Todos</option>
              <option value="INSUMO_PRODUCCION">Insumo de producción</option>
              <option value="REVENTA_DIRECTA">Reventa directa</option>
            </select>
          </div>

          <AvisoCopiaLocal enLinea={enLinea} />

          {error && (
            <p className="mensaje-error" role="alert">
              {error}
            </p>
          )}

          {cargando ? (
            <p className="cargando">Cargando existencias…</p>
          ) : (
            <table className="tabla-productos">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock actual</th>
                  <th>Stock mínimo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stock.map((producto) => (
                  <tr
                    key={producto.id}
                    className={`fila-clicable ${productoSeleccionado?.id === producto.id ? 'fila-seleccionada' : ''}`}
                    onClick={() => seleccionarProducto(producto)}
                  >
                    <td>{producto.nombre}</td>
                    <td>
                      {producto.controla_stock ? producto.stock_actual : '—'}
                      <EtiquetaProvisional visible={provisional && producto.controla_stock} />
                    </td>
                    <td>{producto.controla_stock ? producto.stock_minimo : '—'}</td>
                    <td>
                      {producto.alerta_stock_minimo && (
                        <span className="insignia-alerta-stock">Stock mínimo</span>
                      )}
                    </td>
                  </tr>
                ))}
                {stock.length === 0 && (
                  <tr>
                    <td colSpan={4} className="texto-vacio">No hay productos que coincidan con el filtro.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {productoSeleccionado && (
            <section className="formulario-panel panel-historial">
              <div className="encabezado-seccion">
                <h3>Historial — {productoSeleccionado.nombre}</h3>
                <button
                  type="button"
                  className="boton-secundario"
                  onClick={() => setProductoSeleccionado(null)}
                >
                  Cerrar
                </button>
              </div>

              <table className="tabla-productos">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Fecha</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((movimiento) => (
                    <tr key={movimiento.id}>
                      <td>{etiquetaMovimientoInventario(movimiento)}</td>
                      <td>{movimiento.cantidad}</td>
                      <td>{formatoFechaHora(movimiento.fecha)}</td>
                      <td>{movimiento.motivo ?? '—'}</td>
                    </tr>
                  ))}
                  {historial.length === 0 && (
                    <tr>
                      <td colSpan={4} className="texto-vacio">Sin movimientos registrados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}
        </div>

        {/* En escritorio, columna fija a la derecha; en celular, hoja que abre el botón. */}
        <div
          className={`inventario-movimiento ${hojaAbierta ? 'inventario-movimiento-abierta' : ''}`}
          onClick={() => setHojaAbierta(false)}
        >
          <div className="inventario-movimiento-contenido" onClick={(evento) => evento.stopPropagation()}>
            <div className="inventario-movimiento-cerrar">
              <button type="button" className="boton-secundario" onClick={() => setHojaAbierta(false)}>
                Cerrar
              </button>
            </div>
            <PanelMovimientoInventario
              esAdmin={esAdmin}
              productoIdInicial={productoSeleccionado?.controla_stock ? productoSeleccionado.id : null}
              onRegistrado={alRegistrar}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

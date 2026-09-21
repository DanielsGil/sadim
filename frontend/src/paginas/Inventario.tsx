import { useEffect, useState, type FormEvent } from 'react'
import { listarCategorias } from '../api/catalogo'
import { ErrorApi } from '../api/errorApi'
import { listarMovimientos, registrarAjusteManual, registrarMerma } from '../api/inventarioMovimientos'
import { listarStock } from '../api/inventarioStock'
import { useSesion } from '../contexto/SesionContext'
import type { Categoria, MovimientoInventario, StockProducto } from '../tipos/dominio'

/** Inventario (CU-11, CU-13, HU-024, HU-026): existencias, historial y ajustes (ADMIN). */
export function Inventario() {
  const { sesion } = useSesion()
  const esAdmin = sesion?.rol === 'ADMIN'

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [stock, setStock] = useState<StockProducto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [productoSeleccionado, setProductoSeleccionado] = useState<StockProducto | null>(null)
  const [historial, setHistorial] = useState<MovimientoInventario[]>([])

  const [tipoAjuste, setTipoAjuste] = useState<'MERMA' | 'AJUSTE_MANUAL'>('MERMA')
  const [sentidoAjuste, setSentidoAjuste] = useState<'SUMA' | 'RESTA'>('RESTA')
  const [cantidadAjuste, setCantidadAjuste] = useState('')
  const [motivoAjuste, setMotivoAjuste] = useState('')
  const [guardandoAjuste, setGuardandoAjuste] = useState(false)
  const [errorAjuste, setErrorAjuste] = useState<string | null>(null)

  useEffect(() => {
    listarCategorias().then(setCategorias)
  }, [])

  function recargarStock() {
    setCargando(true)
    setError(null)
    listarStock(filtroCategoria || undefined, filtroTipo || undefined)
      .then(setStock)
      .catch((err: unknown) => {
        setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el stock.')
      })
      .finally(() => setCargando(false))
  }

  useEffect(recargarStock, [filtroCategoria, filtroTipo])

  function verHistorial(producto: StockProducto) {
    setProductoSeleccionado(producto)
    setErrorAjuste(null)
    listarMovimientos(producto.id).then(setHistorial)
  }

  async function manejarAjuste(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!productoSeleccionado || !cantidadAjuste || !motivoAjuste) return
    setErrorAjuste(null)
    setGuardandoAjuste(true)
    try {
      if (tipoAjuste === 'MERMA') {
        await registrarMerma(productoSeleccionado.id, Number(cantidadAjuste), motivoAjuste)
      } else {
        await registrarAjusteManual(productoSeleccionado.id, sentidoAjuste, Number(cantidadAjuste), motivoAjuste)
      }
      setCantidadAjuste('')
      setMotivoAjuste('')
      recargarStock()
      listarMovimientos(productoSeleccionado.id).then(setHistorial)
    } catch (err) {
      setErrorAjuste(err instanceof ErrorApi ? err.message : 'No se pudo registrar el ajuste.')
    } finally {
      setGuardandoAjuste(false)
    }
  }

  return (
    <div className="pagina-inventario">
      <h1>Inventario</h1>

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
                className="fila-clicable"
                onClick={() => verHistorial(producto)}
              >
                <td>{producto.nombre}</td>
                <td>{producto.controla_stock ? producto.stock_actual : '—'}</td>
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
        <section className="formulario-panel">
          <div className="encabezado-seccion">
            <h3>Historial — {productoSeleccionado.nombre}</h3>
            <button type="button" className="boton-secundario" onClick={() => setProductoSeleccionado(null)}>
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
                  <td>{movimiento.tipo}{movimiento.sentido ? ` (${movimiento.sentido})` : ''}</td>
                  <td>{movimiento.cantidad}</td>
                  <td>{movimiento.fecha}</td>
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

          {esAdmin && productoSeleccionado.controla_stock && (
            <form className="formulario-panel" onSubmit={manejarAjuste}>
              <h4>Registrar ajuste</h4>
              <label htmlFor="ajuste-tipo">Tipo</label>
              <select
                id="ajuste-tipo"
                value={tipoAjuste}
                onChange={(evento) => setTipoAjuste(evento.target.value as 'MERMA' | 'AJUSTE_MANUAL')}
              >
                <option value="MERMA">Merma</option>
                <option value="AJUSTE_MANUAL">Ajuste manual (conteo físico)</option>
              </select>

              {tipoAjuste === 'AJUSTE_MANUAL' && (
                <>
                  <label htmlFor="ajuste-sentido">Sentido</label>
                  <select
                    id="ajuste-sentido"
                    value={sentidoAjuste}
                    onChange={(evento) => setSentidoAjuste(evento.target.value as 'SUMA' | 'RESTA')}
                  >
                    <option value="SUMA">Suma (sobraban unidades)</option>
                    <option value="RESTA">Resta (faltaban unidades)</option>
                  </select>
                </>
              )}

              <label htmlFor="ajuste-cantidad">Cantidad</label>
              <input
                id="ajuste-cantidad"
                type="number"
                min="0.01"
                step="0.01"
                value={cantidadAjuste}
                onChange={(evento) => setCantidadAjuste(evento.target.value)}
                required
              />

              <label htmlFor="ajuste-motivo">Motivo</label>
              <input
                id="ajuste-motivo"
                value={motivoAjuste}
                onChange={(evento) => setMotivoAjuste(evento.target.value)}
                required
              />

              {errorAjuste && (
                <p className="mensaje-error" role="alert">
                  {errorAjuste}
                </p>
              )}

              <div className="acciones-formulario">
                <button type="submit" disabled={guardandoAjuste}>
                  {guardandoAjuste ? 'Registrando…' : 'Registrar ajuste'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  )
}

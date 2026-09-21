import { useEffect, useState, type FormEvent } from 'react'
import { listarProductos } from '../api/catalogo'
import { mensajeErrorApi } from '../api/errorApi'
import { registrarEntrada } from '../api/inventarioMovimientos'
import type { Producto } from '../tipos/dominio'

/** Ingreso de mercancía (CU-12, HU-025 adelantado) — ADMIN y OPERADOR. */
export function IngresoMercancia() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    listarProductos().then((lista) => {
      const activos = lista.filter((producto) => producto.activo && producto.controla_stock)
      setProductos(activos)
      setProductoId(activos[0]?.id ?? '')
    })
  }, [])

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setMensaje(null)
    if (!productoId) {
      setError('Selecciona un producto.')
      return
    }
    setGuardando(true)
    try {
      const movimiento = await registrarEntrada(productoId, Number(cantidad), motivo)
      setMensaje(`Ingreso registrado: +${movimiento.cantidad} unidades.`)
      setCantidad('')
      setMotivo('')
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo registrar el ingreso.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="pagina-ingreso-mercancia">
      <h1>Ingreso de mercancía</h1>

      {productos.length === 0 ? (
        <p className="texto-vacio">
          No hay productos con control de existencias (controla_stock) en el catálogo.
        </p>
      ) : (
        <form className="formulario-panel" onSubmit={manejarEnvio}>
          <label htmlFor="ingreso-producto">Producto</label>
          <select
            id="ingreso-producto"
            value={productoId}
            onChange={(evento) => setProductoId(evento.target.value)}
            required
          >
            {productos.map((producto) => (
              <option key={producto.id} value={producto.id}>
                {producto.nombre} (stock actual: {producto.stock_actual})
              </option>
            ))}
          </select>

          <label htmlFor="ingreso-cantidad">Cantidad</label>
          <input
            id="ingreso-cantidad"
            type="number"
            min="0.01"
            step="0.01"
            value={cantidad}
            onChange={(evento) => setCantidad(evento.target.value)}
            required
          />

          <label htmlFor="ingreso-motivo">Motivo (opcional)</label>
          <input
            id="ingreso-motivo"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Compra de mercancía…"
          />

          {mensaje && <p className="campo-solo-lectura">{mensaje}</p>}
          {error && (
            <p className="mensaje-error" role="alert">
              {error}
            </p>
          )}

          <div className="acciones-formulario">
            <button type="submit" disabled={guardando}>
              {guardando ? 'Registrando…' : 'Registrar ingreso'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

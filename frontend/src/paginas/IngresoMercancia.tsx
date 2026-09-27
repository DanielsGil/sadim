import { useEffect, useState, type FormEvent } from 'react'
import { listarProductos } from '../api/catalogo'
import { erroresPorCampo } from '../api/erroresPorCampo'
import { mensajeErrorApi } from '../api/errorApi'
import { registrarEntrada } from '../api/inventarioMovimientos'
import { ContadorCantidad } from '../componentes/ContadorCantidad'
import type { Producto } from '../tipos/dominio'

/** Ingreso de mercancía (CU-12, HU-025 adelantado) — ADMIN y OPERADOR. */
export function IngresoMercancia() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({})
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
    setErroresCampo({})
    setMensaje(null)
    if (!productoId) {
      setError('Selecciona un producto.')
      return
    }
    setGuardando(true)
    try {
      const movimiento = await registrarEntrada(productoId, cantidad, motivo)
      setMensaje(`Ingreso registrado: +${movimiento.cantidad} unidades.`)
      setCantidad(1)
      setMotivo('')
    } catch (err) {
      setErroresCampo(erroresPorCampo(err))
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
          <ContadorCantidad id="ingreso-cantidad" valor={cantidad} onCambiar={setCantidad} />
          {erroresCampo.cantidad && <p className="mensaje-error-campo">{erroresCampo.cantidad}</p>}

          <label htmlFor="ingreso-motivo">Motivo (opcional)</label>
          <input
            id="ingreso-motivo"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Compra de mercancía…"
          />
          {erroresCampo.motivo && <p className="mensaje-error-campo">{erroresCampo.motivo}</p>}

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

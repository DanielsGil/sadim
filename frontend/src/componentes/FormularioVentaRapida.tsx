import { useEffect, useState, type FormEvent } from 'react'
import { listarProductos } from '../api/catalogo'
import { obtenerConfiguracionPagos } from '../api/configuracion'
import { mensajeErrorApi } from '../api/errorApi'
import { crearVentaRapida } from '../api/ventas'
import type { ConfiguracionPago, MedioPago, Producto, Venta } from '../tipos/dominio'

interface ItemCarrito {
  producto: Producto
  cantidad: number
}

const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
}

/** Venta rápida de mostrador (CU-01, P-01, HU-012/HU-013/HU-014/HU-015). */
export function FormularioVentaRapida({
  onGuardado,
  onCancelar,
}: {
  onGuardado: (venta: Venta) => void
  onCancelar: () => void
}) {
  const [productos, setProductos] = useState<Producto[]>([])
  const [pagos, setPagos] = useState<ConfiguracionPago | null>(null)
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [medioPago, setMedioPago] = useState<MedioPago | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    listarProductos().then((lista) => {
      const activos = lista.filter((producto) => producto.activo)
      setProductos(activos)
      setProductoId(activos[0]?.id ?? '')
    })
    obtenerConfiguracionPagos().then(setPagos)
  }, [])

  const mediosHabilitados: MedioPago[] = pagos
    ? [
        ...(pagos.acepta_efectivo ? (['EFECTIVO'] as const) : []),
        ...(pagos.acepta_transferencia ? (['TRANSFERENCIA'] as const) : []),
        ...(pagos.acepta_qr ? (['QR'] as const) : []),
      ]
    : []

  function agregarAlCarrito() {
    const producto = productos.find((p) => p.id === productoId)
    const cantidadNumerica = Number(cantidad)
    if (!producto || !(cantidadNumerica > 0)) return
    setCarrito((actual) => [...actual, { producto, cantidad: cantidadNumerica }])
    setCantidad('1')
  }

  function quitarDelCarrito(indice: number) {
    setCarrito((actual) => actual.filter((_, i) => i !== indice))
  }

  const totalEstimado = carrito.reduce(
    (suma, item) => suma + item.producto.precio_venta * item.cantidad,
    0,
  )

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    if (carrito.length === 0) {
      setError('Agrega al menos un producto.')
      return
    }
    if (!medioPago) {
      setError('Selecciona un medio de pago.')
      return
    }
    setGuardando(true)
    try {
      const venta = await crearVentaRapida(
        medioPago,
        carrito.map((item) => ({ producto_id: item.producto.id, cantidad: item.cantidad })),
      )
      onGuardado(venta)
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo registrar la venta.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="formulario-panel formulario-venta-rapida" onSubmit={manejarEnvio}>
      <h3>Venta rápida</h3>

      <label htmlFor="venta-rapida-producto">Producto</label>
      <select
        id="venta-rapida-producto"
        value={productoId}
        onChange={(evento) => setProductoId(evento.target.value)}
      >
        {productos.map((producto) => (
          <option key={producto.id} value={producto.id}>
            {producto.nombre} — {producto.precio_venta}
          </option>
        ))}
      </select>

      <label htmlFor="venta-rapida-cantidad">Cantidad</label>
      <input
        id="venta-rapida-cantidad"
        type="number"
        min="0.01"
        step="0.01"
        value={cantidad}
        onChange={(evento) => setCantidad(evento.target.value)}
      />

      <div className="acciones-formulario">
        <button type="button" className="boton-secundario" onClick={agregarAlCarrito}>
          Agregar
        </button>
      </div>

      <ul className="lista-categorias">
        {carrito.map((item, indice) => (
          <li key={`${item.producto.id}-${indice}`}>
            <span>
              {item.cantidad} × {item.producto.nombre}
            </span>
            <button type="button" className="boton-secundario" onClick={() => quitarDelCarrito(indice)}>
              Quitar
            </button>
          </li>
        ))}
        {carrito.length === 0 && <li className="texto-vacio">Sin productos agregados.</li>}
      </ul>

      <p className="campo-solo-lectura">
        Total estimado: <strong>{totalEstimado.toFixed(2)}</strong> (lo confirma el backend al registrar
        la venta)
      </p>

      <label htmlFor="venta-rapida-medio-pago">Medio de pago</label>
      <select
        id="venta-rapida-medio-pago"
        value={medioPago}
        onChange={(evento) => setMedioPago(evento.target.value as MedioPago)}
      >
        <option value="">Selecciona uno</option>
        {mediosHabilitados.map((medio) => (
          <option key={medio} value={medio}>
            {ETIQUETA_MEDIO_PAGO[medio]}
          </option>
        ))}
      </select>

      {(medioPago === 'TRANSFERENCIA' || medioPago === 'QR') && pagos?.nequi_llave && (
        <p className="campo-solo-lectura">
          Nequi {pagos.nequi_titular ?? ''}: <strong>{pagos.nequi_llave}</strong> — el cobro queda
          pendiente de verificación, nunca como pagado.
        </p>
      )}

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      <div className="acciones-formulario">
        <button type="button" className="boton-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando}>
          {guardando ? 'Registrando…' : 'Registrar venta'}
        </button>
      </div>
    </form>
  )
}

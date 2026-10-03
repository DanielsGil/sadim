import { useEffect, useState, type FormEvent } from 'react'
import { listarCategorias, listarProductos } from '../api/catalogo'
import { obtenerConfiguracionPagos } from '../api/configuracion'
import { mensajeErrorApi } from '../api/errorApi'
import { crearVentaRapida } from '../api/ventas'
import { ContadorCantidad } from './ContadorCantidad'
import { SelectorProductos } from './SelectorProductos'
import { useAcumuladorClics } from './useAcumuladorClics'
import type { Categoria, ConfiguracionPago, MedioPago, Producto, Venta } from '../tipos/dominio'

interface ItemCarrito {
  producto: Producto
  cantidad: number
}

/** E-10: el carrito tiene una sola línea por producto; sumar otra vez el mismo acumula la cantidad. */
function sumarAlCarrito(carrito: ItemCarrito[], producto: Producto, cantidad: number): ItemCarrito[] {
  if (carrito.some((item) => item.producto.id === producto.id)) {
    return carrito.map((item) =>
      item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + cantidad } : item,
    )
  }
  return [...carrito, { producto, cantidad }]
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
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [pagos, setPagos] = useState<ConfiguracionPago | null>(null)
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [medioPago, setMedioPago] = useState<MedioPago | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    listarCategorias().then(setCategorias)
    listarProductos().then((lista) => {
      setProductos(lista.filter((producto) => producto.activo))
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

  // E-10: el carrito es local hasta enviar; los clics se juntan igual que en la sesión.
  const acumulador = useAcumuladorClics((producto, cantidad) => {
    setCarrito((actual) => sumarAlCarrito(actual, producto, cantidad))
  })
  const { pendiente } = acumulador

  function quitarDelCarrito(indice: number) {
    setCarrito((actual) => actual.filter((_, i) => i !== indice))
  }

  const totalEstimado = (pendiente ? sumarAlCarrito(carrito, pendiente.producto, pendiente.cantidad) : carrito).reduce(
    (suma, item) => suma + item.producto.precio_venta * item.cantidad,
    0,
  )

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    // E-10: los clics que aún esperan su segundo de agrupación también entran a la venta.
    const items = pendiente ? sumarAlCarrito(carrito, pendiente.producto, pendiente.cantidad) : carrito
    if (items.length === 0) {
      setError('Agrega al menos un producto.')
      return
    }
    if (!medioPago) {
      setError('Selecciona un medio de pago.')
      return
    }
    acumulador.descartar()
    setCarrito(items)
    setGuardando(true)
    try {
      const venta = await crearVentaRapida(
        medioPago,
        items.map((item) => ({ producto_id: item.producto.id, cantidad: item.cantidad })),
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

      <label>Producto</label>
      <SelectorProductos
        categorias={categorias}
        productos={productos}
        onSeleccionar={acumulador.sumar}
        acumulados={pendiente ? { [pendiente.producto.id]: pendiente.cantidad } : {}}
      />

      {pendiente && (
        <div className="formulario-panel">
          <p className="campo-solo-lectura">
            <strong>{pendiente.producto.nombre}</strong> — {pendiente.producto.precio_venta}
          </p>
          <label htmlFor="venta-rapida-cantidad">Cantidad</label>
          <ContadorCantidad id="venta-rapida-cantidad" valor={pendiente.cantidad} onCambiar={acumulador.ajustar} />
          <div className="acciones-formulario">
            <button type="button" className="boton-secundario" onClick={acumulador.confirmarYa}>
              Agregar al carrito
            </button>
          </div>
        </div>
      )}

      <ul className="lista-categorias">
        {carrito.map((item, indice) => (
          <li key={item.producto.id}>
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
        <button
          type="button"
          className="boton-secundario"
          onClick={() => {
            acumulador.descartar()
            onCancelar()
          }}
        >
          Cancelar
        </button>
        <button type="submit" disabled={guardando}>
          {guardando ? 'Registrando…' : 'Registrar venta'}
        </button>
      </div>
    </form>
  )
}

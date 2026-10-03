import { useEffect, useState } from 'react'
import { listarCategorias, listarProductos } from '../api/catalogo'
import { obtenerConfiguracionPagos } from '../api/configuracion'
import { mensajeErrorApi } from '../api/errorApi'
import { crearVentaRapida } from '../api/ventas'
import { BandejaSeleccion } from './BandejaSeleccion'
import { sumarABandeja, unidadesEnBandeja } from './bandeja'
import { SelectorProductos } from './SelectorProductos'
import { useBandejaPersistente } from './useBandejaPersistente'
import type { Categoria, ConfiguracionPago, MedioPago, Producto, Venta } from '../tipos/dominio'

const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
}

/**
 * Venta rápida de mostrador (CU-01, P-01, HU-012/HU-013/HU-014/HU-015).
 * E-12: la bandeja de selección es el carrito (local hasta cobrar) y su
 * botón es «Cobrar».
 */
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
  // E-19: el carrito se guarda en el dispositivo y se restaura al volver a la venta rápida.
  const [carrito, setCarrito, vaciarCarrito] = useBandejaPersistente('venta-rapida')
  const [medioPago, setMedioPago] = useState<MedioPago | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)

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

  function agregarAlCarrito(producto: Producto) {
    setCarrito((actual) => sumarABandeja(actual, producto))
  }

  function cambiarCantidad(productoId: string, cantidad: number) {
    setCarrito((actual) =>
      actual.map((item) => (item.producto.id === productoId ? { ...item, cantidad } : item)),
    )
  }

  function quitarDelCarrito(productoId: string) {
    setCarrito((actual) => actual.filter((item) => item.producto.id !== productoId))
  }

  async function cobrar() {
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
      await vaciarCarrito()
      onGuardado(venta)
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo registrar la venta.'))
    } finally {
      setGuardando(false)
    }
  }

  function manejarCancelar() {
    if (carrito.length > 0 && !confirmandoCancelar) {
      setConfirmandoCancelar(true)
      return
    }
    onCancelar()
  }

  return (
    <form
      className="formulario-panel formulario-venta-rapida"
      // Enter en el buscador no debe cobrar: solo cobra el botón de la bandeja.
      onSubmit={(evento) => evento.preventDefault()}
    >
      <div className="encabezado-seccion">
        <h3>Venta rápida</h3>
        <button type="button" className="boton-secundario" onClick={manejarCancelar}>
          Cancelar
        </button>
      </div>

      {confirmandoCancelar && (
        <div className="confirmacion-bandeja" role="alert">
          <p>
            Hay {unidadesEnBandeja(carrito)} producto(s) en el carrito. ¿Descartar la venta?
          </p>
          <div className="acciones-formulario">
            <button type="button" className="boton-secundario" onClick={() => setConfirmandoCancelar(false)}>
              Seguir vendiendo
            </button>
            <button
              type="button"
              onClick={() => {
                void vaciarCarrito().then(onCancelar)
              }}
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      <div className="zona-seleccion">
        <div className="zona-seleccion-selector">
          <SelectorProductos
            categorias={categorias}
            productos={productos}
            onSeleccionar={agregarAlCarrito}
            acumulados={Object.fromEntries(carrito.map((item) => [item.producto.id, item.cantidad]))}
          />
        </div>

        <BandejaSeleccion
          items={carrito}
          onCambiarCantidad={cambiarCantidad}
          onQuitar={quitarDelCarrito}
          textoBoton="Cobrar"
          textoBotonCorto="Cobrar"
          confirmarDesdeBarra={false}
          textoProcesando="Registrando…"
          onConfirmar={() => void cobrar()}
          procesando={guardando}
        >
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
        </BandejaSeleccion>
      </div>
    </form>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listarCategorias, listarProductos } from '../api/catalogo'
import { obtenerConfiguracionPagos } from '../api/configuracion'
import { ErrorApi, mensajeErrorApi } from '../api/errorApi'
import { listarMesas } from '../api/mesas'
import {
  abrirSesion,
  agregarDetalle,
  cancelarVenta,
  cerrarVenta,
  listarVentas,
  quitarDetalle,
} from '../api/ventas'
import { AvisoCopiaLocal } from '../componentes/AvisoLocal'
import { ContadorCantidad } from '../componentes/ContadorCantidad'
import { SelectorProductos } from '../componentes/SelectorProductos'
import { useEstadoLocal } from '../sync/useEstadoLocal'
import type { Categoria, ConfiguracionPago, Mesa, MedioPago, Producto, Venta } from '../tipos/dominio'

const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
}

/** Detalle de sesión dinámica (CU-03, CU-04, HU-016..HU-019, HU-048). */
export function DetalleSesion() {
  const { mesaId } = useParams<{ mesaId: string }>()
  const navigate = useNavigate()
  const { enLinea, provisional } = useEstadoLocal()

  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [venta, setVenta] = useState<Venta | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [pagos, setPagos] = useState<ConfiguracionPago | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [productoElegido, setProductoElegido] = useState<Producto | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [medioPago, setMedioPago] = useState<MedioPago | ''>('')
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false)
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    if (!mesaId) return
    setCargando(true)
    Promise.all([
      listarVentas({ mesaId, estado: 'ABIERTA' }),
      listarCategorias(),
      listarProductos(),
      obtenerConfiguracionPagos(),
      listarMesas({ activa: true }),
    ])
      .then(([ventas, listaCategorias, listaProductos, pagosObtenidos, mesas]) => {
        setVenta(ventas[0] ?? null)
        setCategorias(listaCategorias)
        setProductos(listaProductos.filter((producto) => producto.activo))
        setPagos(pagosObtenidos)
        setMesa(mesas.find((m) => m.id === mesaId) ?? null)
      })
      .catch((err: unknown) => {
        setError(mensajeErrorApi(err, 'No se pudo cargar la sesión.'))
      })
      .finally(() => setCargando(false))
  }, [mesaId])

  const mediosHabilitados: MedioPago[] = pagos
    ? [
        ...(pagos.acepta_efectivo ? (['EFECTIVO'] as const) : []),
        ...(pagos.acepta_transferencia ? (['TRANSFERENCIA'] as const) : []),
        ...(pagos.acepta_qr ? (['QR'] as const) : []),
      ]
    : []

  function nombreProducto(productoId: string): string {
    return productos.find((producto) => producto.id === productoId)?.nombre ?? '—'
  }

  /**
   * D26 (E-09, Lote de correcciones 3): tocar la mesa no abre la sesión —
   * se abre al agregar el primer producto. Si la sesión no existe todavía,
   * se envía (1) abrir sesión y (2) el detalle, en ese orden; si (2) falla,
   * se cancela la sesión recién creada para no dejar la mesa OCUPADA vacía.
   * Sin conexión, ambas quedan en la cola en ese mismo orden (D17).
   */
  async function manejarAgregar() {
    if (!productoElegido || !mesaId) return
    setError(null)
    setProcesando(true)
    let ventaActual = venta
    let creadaEnEsteIntento = false
    try {
      if (!ventaActual) {
        try {
          ventaActual = await abrirSesion(mesaId)
        } catch (err) {
          if (err instanceof ErrorApi && err.code === 'MESA_OCUPADA') {
            setError(mensajeErrorApi(err, 'Otro dispositivo ya abrió esta mesa.'))
            navigate('/ventas')
            return
          }
          throw err
        }
        creadaEnEsteIntento = true
        setVenta(ventaActual)
      }
      await agregarDetalle(ventaActual.id, productoElegido.id, cantidad)
      const ventas = await listarVentas({ mesaId, estado: 'ABIERTA' })
      setVenta(ventas[0] ?? null)
      setCantidad(1)
      setProductoElegido(null)
    } catch (err) {
      if (creadaEnEsteIntento && ventaActual) {
        try {
          await cancelarVenta(ventaActual.id)
        } catch {
          // Mejor esfuerzo: no ocultar el error original de agregarDetalle.
        }
        setVenta(null)
      }
      setError(mensajeErrorApi(err, 'No se pudo agregar el producto.'))
    } finally {
      setProcesando(false)
    }
  }

  async function manejarQuitar(detalleId: string) {
    if (!venta) return
    setError(null)
    setProcesando(true)
    try {
      await quitarDetalle(venta.id, detalleId)
      const ventas = await listarVentas({ mesaId: venta.mesa_id ?? undefined, estado: 'ABIERTA' })
      setVenta(ventas[0] ?? null)
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo quitar el producto.'))
    } finally {
      setProcesando(false)
    }
  }

  async function manejarCerrar() {
    if (!venta || !medioPago) {
      setError('Selecciona un medio de pago para cerrar.')
      return
    }
    setError(null)
    setProcesando(true)
    try {
      await cerrarVenta(venta.id, medioPago)
      navigate('/ventas')
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo cerrar la sesión.'))
    } finally {
      setProcesando(false)
    }
  }

  async function manejarCancelar() {
    if (!venta) return
    setError(null)
    setProcesando(true)
    try {
      await cancelarVenta(venta.id)
      navigate('/ventas')
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo cancelar la sesión.'))
      setProcesando(false)
    }
  }

  if (cargando) {
    return <p className="cargando">Cargando sesión…</p>
  }

  // D22: cuando la escritura va a la cola (sin conexión o con cola pendiente) el servidor no
  // valida el stock al agregar; se advierte, sin bloquear (D24: el conflicto queda para el cierre).
  const yaAgregada = (venta?.detalles ?? [])
    .filter((detalle) => detalle.producto_id === productoElegido?.id)
    .reduce((suma, detalle) => suma + detalle.cantidad, 0)
  const superaStockLocal =
    provisional &&
    !!productoElegido?.controla_stock &&
    yaAgregada + cantidad > productoElegido.stock_actual

  return (
    <div className="pagina-detalle-sesion">
      <div className="encabezado-seccion">
        <h1>{mesa ? `Mesa ${mesa.numero}` : 'Sesión'}</h1>
        <button type="button" className="boton-secundario" onClick={() => navigate('/ventas')}>
          Volver al mapa de mesas
        </button>
      </div>

      <AvisoCopiaLocal enLinea={enLinea} />

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      {venta ? (
        <>
          <table className="tabla-productos">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Subtotal</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {venta.detalles.map((detalle) => (
                <tr key={detalle.id}>
                  <td>{nombreProducto(detalle.producto_id)}</td>
                  <td>{detalle.cantidad}</td>
                  <td>{detalle.precio_unitario}</td>
                  <td>{detalle.subtotal}</td>
                  <td>
                    <button
                      type="button"
                      className="boton-secundario"
                      disabled={procesando}
                      onClick={() => void manejarQuitar(detalle.id)}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
              {venta.detalles.length === 0 && (
                <tr>
                  <td colSpan={5} className="texto-vacio">
                    Todavía no se han agregado productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <p className="campo-solo-lectura">
            Total: <strong>{venta.total}</strong>
          </p>
        </>
      ) : (
        // D26 (E-09): tocar la mesa no abre nada por sí solo — la sesión se
        // crea al agregar el primer producto.
        <p className="texto-vacio">Todavía no se ha abierto nada. Agrega el primer producto para abrir la sesión.</p>
      )}

      <section className="formulario-panel panel-selector-productos">
        <h3>Agregar producto</h3>
        <SelectorProductos categorias={categorias} productos={productos} onSeleccionar={setProductoElegido} />

        {productoElegido && (
          <>
            <p className="campo-solo-lectura">
              <strong>{productoElegido.nombre}</strong> — {productoElegido.precio_venta}
            </p>
            <label htmlFor="detalle-cantidad">Cantidad</label>
            <ContadorCantidad id="detalle-cantidad" valor={cantidad} onCambiar={setCantidad} />
          </>
        )}

        {superaStockLocal && (
          <p className="campo-solo-lectura">
            La cantidad supera el stock que se ve en este dispositivo; puede generar un conflicto al
            sincronizar. Puedes agregarla igual.
          </p>
        )}

        <div className="acciones-formulario">
          <button type="button" disabled={procesando || !productoElegido} onClick={() => void manejarAgregar()}>
            Agregar
          </button>
        </div>
      </section>

      {venta && (
        <>
          <section className="formulario-panel">
            <h3>Cerrar sesión</h3>
            <label htmlFor="detalle-medio-pago">Medio de pago</label>
            <select
              id="detalle-medio-pago"
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

            <div className="acciones-formulario">
              <button type="button" disabled={procesando} onClick={() => void manejarCerrar()}>
                Cerrar sesión
              </button>
            </div>
          </section>

          <section className="formulario-panel">
            {confirmandoCancelacion ? (
              <>
                <p>¿Seguro que quieres cancelar esta sesión? No se generará ningún movimiento.</p>
                <div className="acciones-formulario">
                  <button
                    type="button"
                    className="boton-secundario"
                    onClick={() => setConfirmandoCancelacion(false)}
                  >
                    No
                  </button>
                  <button type="button" disabled={procesando} onClick={() => void manejarCancelar()}>
                    Sí, cancelar sesión
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="boton-secundario"
                onClick={() => setConfirmandoCancelacion(true)}
              >
                Cancelar sesión
              </button>
            )}
          </section>
        </>
      )}
    </div>
  )
}

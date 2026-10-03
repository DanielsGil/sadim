import { useEffect, useRef, useState } from 'react'
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
import { useAcumuladorClics } from '../componentes/useAcumuladorClics'
import { useEstadoLocal } from '../sync/useEstadoLocal'
import type { Categoria, ConfiguracionPago, DetalleVenta, Mesa, MedioPago, Producto, Venta } from '../tipos/dominio'

const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
}

interface LineaAgrupada {
  producto_id: string
  cantidad: number
  /** null si las líneas del producto tienen precios distintos (D19: precio enviado por el dispositivo). */
  precio_unitario: number | null
  subtotal: number
  /** La línea más reciente del producto: «Quitar» la borra a ella (D11), una a la vez. */
  ultima: DetalleVenta
  lineas: number
}

/**
 * E-10: SOLO presentación — agrupa las líneas del mismo producto mostrando la
 * cantidad total. El backend sigue teniendo una DetalleVenta por envío; no se
 * edita ninguna línea existente (Contrato sin cambios).
 */
function agruparPorProducto(detalles: DetalleVenta[]): LineaAgrupada[] {
  const grupos = new Map<string, LineaAgrupada>()
  for (const detalle of detalles) {
    const grupo = grupos.get(detalle.producto_id)
    if (!grupo) {
      grupos.set(detalle.producto_id, {
        producto_id: detalle.producto_id,
        cantidad: Number(detalle.cantidad),
        precio_unitario: detalle.precio_unitario,
        subtotal: Number(detalle.subtotal),
        ultima: detalle,
        lineas: 1,
      })
      continue
    }
    grupo.cantidad += Number(detalle.cantidad)
    grupo.subtotal += Number(detalle.subtotal)
    if (String(grupo.precio_unitario) !== String(detalle.precio_unitario)) grupo.precio_unitario = null
    grupo.ultima = detalle
    grupo.lineas += 1
  }
  return [...grupos.values()]
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

  const [medioPago, setMedioPago] = useState<MedioPago | ''>('')
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false)
  const [procesando, setProcesando] = useState(false)
  // E-10: envíos de líneas en curso. Se encadenan uno tras otro para que dos
  // productos seguidos no intenten abrir la sesión dos veces (D26).
  const [enviando, setEnviando] = useState(0)
  const colaEnviosRef = useRef<Promise<void>>(Promise.resolve())
  const ventaRef = useRef<Venta | null>(null)
  const falloEnvioRef = useRef(false)
  const abandonadaRef = useRef(false)

  function fijarVenta(nueva: Venta | null) {
    ventaRef.current = nueva
    setVenta(nueva)
  }

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
        fijarVenta(ventas[0] ?? null)
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
   * E-10: lo dispara el acumulador de clics, con la cantidad ya acumulada.
   */
  async function enviarLinea(producto: Producto, cantidad: number) {
    if (!mesaId || abandonadaRef.current) return
    setError(null)
    let ventaActual = ventaRef.current
    let creadaEnEsteIntento = false
    try {
      if (!ventaActual) {
        try {
          ventaActual = await abrirSesion(mesaId)
        } catch (err) {
          if (err instanceof ErrorApi && err.code === 'MESA_OCUPADA') {
            setError(mensajeErrorApi(err, 'Otro dispositivo ya abrió esta mesa.'))
            falloEnvioRef.current = true
            abandonadaRef.current = true
            navigate('/ventas')
            return
          }
          throw err
        }
        creadaEnEsteIntento = true
        fijarVenta(ventaActual)
      }
      await agregarDetalle(ventaActual.id, producto.id, cantidad)
      const ventas = await listarVentas({ mesaId, estado: 'ABIERTA' })
      fijarVenta(ventas[0] ?? null)
    } catch (err) {
      falloEnvioRef.current = true
      if (creadaEnEsteIntento && ventaActual) {
        try {
          await cancelarVenta(ventaActual.id)
        } catch {
          // Mejor esfuerzo: no ocultar el error original de agregarDetalle.
        }
        fijarVenta(null)
      }
      setError(mensajeErrorApi(err, 'No se pudo agregar el producto.'))
    }
  }

  const acumulador = useAcumuladorClics((producto, cantidad) => {
    setEnviando((n) => n + 1)
    colaEnviosRef.current = colaEnviosRef.current
      .then(() => enviarLinea(producto, cantidad))
      .finally(() => setEnviando((n) => n - 1))
  })
  const { pendiente } = acumulador

  /** E-10: envía ya lo acumulado y espera los envíos en curso; false si alguno falló. */
  async function esperarEnvios(): Promise<boolean> {
    falloEnvioRef.current = false
    acumulador.confirmarYa()
    await colaEnviosRef.current
    return !falloEnvioRef.current
  }

  async function manejarQuitar(detalleId: string) {
    if (!venta) return
    setError(null)
    setProcesando(true)
    try {
      await quitarDetalle(venta.id, detalleId)
      const ventas = await listarVentas({ mesaId: venta.mesa_id ?? undefined, estado: 'ABIERTA' })
      fijarVenta(ventas[0] ?? null)
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
      // E-10: los clics que aún esperan su envío entran antes de cerrar.
      if (!(await esperarEnvios()) || !ventaRef.current) {
        setProcesando(false)
        return
      }
      await cerrarVenta(ventaRef.current.id, medioPago)
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
      acumulador.descartar()
      await colaEnviosRef.current
      if (!ventaRef.current) {
        navigate('/ventas')
        return
      }
      await cancelarVenta(ventaRef.current.id)
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
    .filter((detalle) => detalle.producto_id === pendiente?.producto.id)
    .reduce((suma, detalle) => suma + Number(detalle.cantidad), 0)
  const superaStockLocal =
    provisional &&
    !!pendiente?.producto.controla_stock &&
    yaAgregada + pendiente.cantidad > pendiente.producto.stock_actual
  const ocupado = procesando || enviando > 0

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
              {agruparPorProducto(venta.detalles).map((grupo) => (
                <tr key={grupo.producto_id}>
                  <td>{nombreProducto(grupo.producto_id)}</td>
                  <td>{grupo.cantidad}</td>
                  <td>{grupo.precio_unitario ?? 'Varios'}</td>
                  <td>{grupo.subtotal.toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className="boton-secundario"
                      disabled={ocupado}
                      onClick={() => void manejarQuitar(grupo.ultima.id)}
                      title={grupo.lineas > 1 ? 'Quita lo último que se agregó de este producto' : undefined}
                    >
                      {grupo.lineas > 1 ? `Quitar últimos ${Number(grupo.ultima.cantidad)}` : 'Quitar'}
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
        <SelectorProductos
          categorias={categorias}
          productos={productos}
          onSeleccionar={acumulador.sumar}
          acumulados={pendiente ? { [pendiente.producto.id]: pendiente.cantidad } : {}}
        />

        {pendiente && (
          <>
            <p className="campo-solo-lectura">
              <strong>{pendiente.producto.nombre}</strong> — {pendiente.producto.precio_venta}
            </p>
            <label htmlFor="detalle-cantidad">Cantidad</label>
            <ContadorCantidad id="detalle-cantidad" valor={pendiente.cantidad} onCambiar={acumulador.ajustar} />
          </>
        )}

        {superaStockLocal && (
          <p className="campo-solo-lectura">
            La cantidad supera el stock que se ve en este dispositivo; puede generar un conflicto al
            sincronizar. Puedes agregarla igual.
          </p>
        )}

        <div className="acciones-formulario">
          <button type="button" disabled={procesando || !pendiente} onClick={acumulador.confirmarYa}>
            {enviando > 0 ? 'Agregando…' : 'Agregar'}
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

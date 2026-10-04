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
import { sumarABandeja, unidadesEnBandeja, type ItemBandeja } from '../componentes/bandeja'
import { BandejaSeleccion } from '../componentes/BandejaSeleccion'
import { SelectorProductos } from '../componentes/SelectorProductos'
import { useBandejaPersistente } from '../componentes/useBandejaPersistente'
import { useEstadoLocal } from '../sync/useEstadoLocal'
import type { Categoria, ConfiguracionPago, DetalleVenta, Mesa, MedioPago, Producto, Venta } from '../tipos/dominio'
import { formatoMoneda } from '../utilidades/formato'

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
  // A3 (F-8): «Cobrando…» solo mientras se envía el cobro.
  const [cobrando, setCobrando] = useState(false)
  // E-12: bandeja de selección. Nunca se envía sola: solo con «Agregar a la mesa».
  // E-19: guardada en el dispositivo, una por mesa (el botón «atrás» no la pierde).
  const [bandeja, setBandeja, vaciarBandeja] = useBandejaPersistente(mesaId ? `mesa:${mesaId}` : null)
  const [agregando, setAgregando] = useState(false)
  // E-12: con productos en la bandeja, salir o cerrar la cuenta primero pregunta.
  const [salidaPendiente, setSalidaPendiente] = useState<string | null>(null)
  const [confirmandoCierreConBandeja, setConfirmandoCierreConBandeja] = useState(false)

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
        setError(mensajeErrorApi(err, 'No se pudo cargar la cuenta.'))
      })
      .finally(() => setCargando(false))
  }, [mesaId])

  // E-12: con productos en la bandeja, un clic en cualquier enlace del menú o
  // de la app no navega directo: primero avisa que la bandeja queda guardada
  // (F-23: salir no la vacía). Recargar o cerrar la
  // pestaña muestra el aviso del navegador. Nunca se envía nada solo.
  const hayBandeja = bandeja.length > 0
  useEffect(() => {
    if (!hayBandeja) return
    const alHacerClic = (evento: MouseEvent) => {
      const objetivo = evento.target as Element | null
      const enlace = objetivo?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!enlace || enlace.target === '_blank') return
      const destino = new URL(enlace.href)
      if (destino.origin !== window.location.origin || destino.pathname === window.location.pathname) return
      evento.preventDefault()
      evento.stopPropagation()
      setSalidaPendiente(`${destino.pathname}${destino.search}`)
    }
    const antesDeDescargar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault()
      evento.returnValue = ''
    }
    document.addEventListener('click', alHacerClic, true)
    window.addEventListener('beforeunload', antesDeDescargar)
    return () => {
      document.removeEventListener('click', alHacerClic, true)
      window.removeEventListener('beforeunload', antesDeDescargar)
    }
  }, [hayBandeja])

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

  function agregarABandeja(producto: Producto) {
    setBandeja((actual) => sumarABandeja(actual, producto))
  }

  function cambiarCantidadBandeja(productoId: string, cantidad: number) {
    setBandeja((actual) =>
      actual.map((item) => (item.producto.id === productoId ? { ...item, cantidad, error: undefined } : item)),
    )
  }

  function quitarDeBandeja(productoId: string) {
    setBandeja((actual) => actual.filter((item) => item.producto.id !== productoId))
  }

  function intentarSalir(destino: string) {
    if (hayBandeja) {
      setSalidaPendiente(destino)
      return
    }
    navigate(destino)
  }

  /**
   * E-12 + D26: envía la bandeja en orden, una petición por producto (el
   * Contrato no admite varias líneas en un mismo POST de detalles). Si la
   * sesión no existe, primero la abre. Si falla la PRIMERA línea de una
   * sesión recién abierta, la cancela para no dejar la mesa OCUPADA vacía.
   * Si falla una posterior, la sesión se queda con lo que sí entró y la
   * bandeja conserva solo las líneas que fallaron, con su error.
   * Sin conexión, todo va a la cola en este mismo orden (D17).
   */
  async function agregarALaMesa() {
    if (!mesaId || bandeja.length === 0) return
    setError(null)
    setAgregando(true)
    let ventaActual = venta
    let creadaEnEsteIntento = false
    const fallidas: ItemBandeja[] = []
    try {
      if (!ventaActual) {
        try {
          ventaActual = await abrirSesion(mesaId)
        } catch (err) {
          if (err instanceof ErrorApi && err.code === 'MESA_OCUPADA') {
            await vaciarBandeja()
            setError(mensajeErrorApi(err, 'Otro dispositivo ya abrió esta mesa.'))
            navigate('/ventas')
            return
          }
          setError(mensajeErrorApi(err, 'No se pudo abrir la cuenta.'))
          return
        }
        creadaEnEsteIntento = true
        setVenta(ventaActual)
      }

      for (const [indice, item] of bandeja.entries()) {
        try {
          await agregarDetalle(ventaActual.id, item.producto.id, item.cantidad)
        } catch (err) {
          const mensaje = mensajeErrorApi(err, 'No se pudo agregar el producto.')
          if (indice === 0 && creadaEnEsteIntento) {
            try {
              await cancelarVenta(ventaActual.id)
            } catch {
              // Mejor esfuerzo: no ocultar el error original de agregarDetalle.
            }
            setVenta(null)
            // No entró nada: la bandeja queda completa, con el error en la primera línea.
            setBandeja((actual) =>
              actual.map((linea, i) => (i === 0 ? { ...linea, error: mensaje } : { ...linea, error: undefined })),
            )
            setError(mensaje)
            return
          }
          fallidas.push({ ...item, error: mensaje })
        }
      }

      setBandeja(fallidas)
      if (fallidas.length > 0) {
        setError('Algunos productos no se agregaron; quedaron en la bandeja con su error.')
      }
      const ventas = await listarVentas({ mesaId, estado: 'ABIERTA' })
      setVenta(ventas[0] ?? null)
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo actualizar la cuenta.'))
    } finally {
      setAgregando(false)
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

  async function manejarCerrar(confirmadoSinBandeja = false) {
    if (!venta || !medioPago) {
      setError('Selecciona un medio de pago para cobrar.')
      return
    }
    // E-12: lo que esté en la bandeja no se envía solo; se pregunta.
    if (hayBandeja && !confirmadoSinBandeja) {
      setConfirmandoCierreConBandeja(true)
      return
    }
    setConfirmandoCierreConBandeja(false)
    setError(null)
    setProcesando(true)
    setCobrando(true)
    try {
      await cerrarVenta(venta.id, medioPago)
      await vaciarBandeja()
      navigate('/ventas')
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo cobrar la cuenta.'))
    } finally {
      setProcesando(false)
      setCobrando(false)
    }
  }

  async function manejarCancelar() {
    if (!venta) return
    setError(null)
    setProcesando(true)
    try {
      await cancelarVenta(venta.id)
      await vaciarBandeja()
      navigate('/ventas')
    } catch (err) {
      setError(mensajeErrorApi(err, 'No se pudo cancelar la cuenta.'))
      setProcesando(false)
    }
  }

  if (cargando) {
    return <p className="cargando">Cargando cuenta…</p>
  }

  // D22: cuando la escritura va a la cola (sin conexión o con cola pendiente) el servidor no
  // valida el stock al agregar; se advierte, sin bloquear (D24: el conflicto queda para el cierre).
  const bandejaConAvisos = bandeja.map((item) => {
    const yaAgregada = (venta?.detalles ?? [])
      .filter((detalle) => detalle.producto_id === item.producto.id)
      .reduce((suma, detalle) => suma + Number(detalle.cantidad), 0)
    const supera =
      provisional && item.producto.controla_stock && yaAgregada + item.cantidad > item.producto.stock_actual
    return supera
      ? {
          ...item,
          aviso: 'Supera el stock que se ve en este dispositivo; puede generar un conflicto al sincronizar.',
        }
      : item
  })
  const ocupado = procesando || agregando

  return (
    <div className={`pagina-detalle-sesion ${hayBandeja ? 'con-bandeja' : ''}`}>
      <div className="encabezado-seccion">
        <h1>{mesa ? `Mesa ${mesa.numero}` : 'Cuenta'}</h1>
        <button type="button" className="boton-secundario" onClick={() => intentarSalir('/ventas')}>
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
                  <td>{grupo.precio_unitario !== null ? formatoMoneda(grupo.precio_unitario) : 'Varios'}</td>
                  <td>{formatoMoneda(grupo.subtotal)}</td>
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
            Total: <strong>{formatoMoneda(venta.total)}</strong>
          </p>
        </>
      ) : (
        // D26 (E-09): tocar la mesa no abre nada por sí solo — la sesión se
        // crea al agregar el primer producto.
        <p className="texto-vacio">Esta mesa no tiene una cuenta abierta. Agrega el primer producto para abrirla.</p>
      )}

      <section className="formulario-panel panel-selector-productos">
        <h3>Agregar producto</h3>
        <div className="zona-seleccion">
          <div className="zona-seleccion-selector">
            <SelectorProductos
              categorias={categorias}
              productos={productos}
              onSeleccionar={agregarABandeja}
              acumulados={Object.fromEntries(bandeja.map((item) => [item.producto.id, item.cantidad]))}
            />
          </div>
          <BandejaSeleccion
            items={bandejaConAvisos}
            onCambiarCantidad={cambiarCantidadBandeja}
            onQuitar={quitarDeBandeja}
            textoBoton="Agregar a la mesa"
            textoBotonCorto="Agregar"
            textoProcesando="Agregando…"
            onConfirmar={() => void agregarALaMesa()}
            procesando={agregando}
            deshabilitado={procesando}
          />
        </div>
      </section>

      {venta && (
        <>
          <section className="formulario-panel">
            <h3>Cobrar cuenta</h3>
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

            {confirmandoCierreConBandeja ? (
              <div className="confirmacion-bandeja" role="alert">
                <p>
                  Hay {unidadesEnBandeja(bandeja)} producto(s) en la bandeja que no se han agregado a la
                  mesa. ¿Cerrar la cuenta sin ellos?
                </p>
                <div className="acciones-formulario">
                  <button
                    type="button"
                    className="boton-secundario"
                    onClick={() => setConfirmandoCierreConBandeja(false)}
                  >
                    Volver
                  </button>
                  <button type="button" disabled={ocupado} onClick={() => void manejarCerrar(true)}>
                    Cerrar sin agregarlos
                  </button>
                </div>
              </div>
            ) : (
              <div className="acciones-formulario">
                <button type="button" disabled={ocupado} onClick={() => void manejarCerrar()}>
                  {cobrando ? 'Cobrando…' : 'Cobrar y cerrar cuenta'}
                </button>
              </div>
            )}
          </section>

          <section className="formulario-panel">
            {confirmandoCancelacion ? (
              <>
                <p>¿Seguro que quieres cancelar esta cuenta? No se cobrará nada ni se descontará inventario.</p>
                <div className="acciones-formulario">
                  <button
                    type="button"
                    className="boton-secundario"
                    onClick={() => setConfirmandoCancelacion(false)}
                  >
                    No
                  </button>
                  <button type="button" disabled={ocupado} onClick={() => void manejarCancelar()}>
                    Sí, cancelar cuenta
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="boton-secundario"
                onClick={() => setConfirmandoCancelacion(true)}
              >
                Cancelar cuenta
              </button>
            )}
          </section>
        </>
      )}

      {salidaPendiente && (
        <div className="dialogo-fondo" role="presentation">
          <div className="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dialogo-salida-titulo">
            <h3 id="dialogo-salida-titulo">Productos sin agregar</h3>
            <p>
              Hay {unidadesEnBandeja(bandeja)} producto(s) en la bandeja que todavía no se han agregado a la
              mesa. Quedan guardados en la bandeja hasta que los agregues o los quites.
            </p>
            <div className="acciones-formulario">
              <button type="button" className="boton-secundario" onClick={() => setSalidaPendiente(null)}>
                Quedarme
              </button>
              {/* F-23: salir no vacía la bandeja (E-19): queda guardada para esta mesa,
                  igual que con el gesto «atrás». */}
              <button
                type="button"
                onClick={() => {
                  const destino = salidaPendiente
                  setSalidaPendiente(null)
                  navigate(destino)
                }}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

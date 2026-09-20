import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { listarProductos } from '../api/catalogo'
import { obtenerConfiguracionPagos } from '../api/configuracion'
import { ErrorApi } from '../api/errorApi'
import {
  cambiarEstadoOrden,
  listarConsumos,
  obtenerCostos,
  obtenerOrden,
  registrarAbono,
  registrarConsumo,
  registrarCosto,
} from '../api/ordenesTrabajo'
import { useSesion } from '../contexto/SesionContext'
import type {
  ConfiguracionPago,
  ConsumoOrden,
  CostoOperativoOrden,
  EstadoOrden,
  MedioPago,
  OrdenTrabajoDetalle as OrdenTrabajoDetalleTipo,
  Producto,
} from '../tipos/dominio'

const ETIQUETA_ESTADO: Record<EstadoOrden, string> = {
  RECIBIDO: 'Recibido',
  EN_PROCESO: 'En proceso',
  LISTO: 'Listo',
  ENTREGADO: 'Entregado',
}

const SIGUIENTE_ESTADO: Record<EstadoOrden, EstadoOrden | null> = {
  RECIBIDO: 'EN_PROCESO',
  EN_PROCESO: 'LISTO',
  LISTO: 'ENTREGADO',
  ENTREGADO: null,
}

const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
}

const ETIQUETA_ESTADO_PAGO: Record<string, string> = {
  CONFIRMADO: 'Confirmado',
  PENDIENTE_VERIFICACION: 'Pendiente de verificación',
}

/** Detalle de orden de trabajo (CU-07..CU-10, HU-021, HU-022, HU-041, HU-023). */
export function DetalleOrden() {
  const { ordenId } = useParams<{ ordenId: string }>()
  const navigate = useNavigate()
  const { sesion } = useSesion()
  const esAdmin = sesion?.rol === 'ADMIN'

  const [orden, setOrden] = useState<OrdenTrabajoDetalleTipo | null>(null)
  const [consumos, setConsumos] = useState<ConsumoOrden[]>([])
  const [costos, setCostos] = useState<CostoOperativoOrden[]>([])
  const [utilidadNeta, setUtilidadNeta] = useState<number | null>(null)
  const [productos, setProductos] = useState<Producto[]>([])
  const [pagos, setPagos] = useState<ConfiguracionPago | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [confirmandoEntrega, setConfirmandoEntrega] = useState(false)

  const [valorAbono, setValorAbono] = useState('')
  const [medioPagoAbono, setMedioPagoAbono] = useState<MedioPago | ''>('')
  const [productoConsumoId, setProductoConsumoId] = useState('')
  const [cantidadConsumo, setCantidadConsumo] = useState('1')
  const [conceptoCosto, setConceptoCosto] = useState('')
  const [valorCosto, setValorCosto] = useState('')

  function recargar() {
    if (!ordenId) return
    setCargando(true)
    setError(null)
    const pedidos: Promise<unknown>[] = [
      obtenerOrden(ordenId).then(setOrden),
      listarConsumos(ordenId).then(setConsumos),
      listarProductos().then((lista) => setProductos(lista.filter((p) => p.activo))),
      obtenerConfiguracionPagos().then(setPagos),
    ]
    if (esAdmin) {
      pedidos.push(
        obtenerCostos(ordenId).then((datos) => {
          setCostos(datos.costos)
          setUtilidadNeta(datos.utilidad_neta)
        }),
      )
    }
    Promise.all(pedidos)
      .catch((err: unknown) => {
        setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar la orden.')
      })
      .finally(() => setCargando(false))
  }

  useEffect(recargar, [ordenId, esAdmin])

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

  async function manejarAvanzarEstado() {
    if (!orden) return
    const siguiente = SIGUIENTE_ESTADO[orden.estado]
    if (!siguiente) return
    if (siguiente === 'ENTREGADO' && !confirmandoEntrega) {
      setConfirmandoEntrega(true)
      return
    }
    setError(null)
    setProcesando(true)
    try {
      await cambiarEstadoOrden(orden.id, siguiente)
      setConfirmandoEntrega(false)
      recargar()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo avanzar el estado de la orden.')
    } finally {
      setProcesando(false)
    }
  }

  async function manejarAbono() {
    if (!orden || !medioPagoAbono || !valorAbono) return
    setError(null)
    setProcesando(true)
    try {
      await registrarAbono(orden.id, Number(valorAbono), medioPagoAbono)
      setValorAbono('')
      setMedioPagoAbono('')
      recargar()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo registrar el abono.')
    } finally {
      setProcesando(false)
    }
  }

  async function manejarConsumo() {
    if (!orden || !productoConsumoId) return
    setError(null)
    setProcesando(true)
    try {
      await registrarConsumo(orden.id, productoConsumoId, Number(cantidadConsumo))
      setCantidadConsumo('1')
      recargar()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo registrar el consumo.')
    } finally {
      setProcesando(false)
    }
  }

  async function manejarCosto() {
    if (!orden || !conceptoCosto || !valorCosto) return
    setError(null)
    setProcesando(true)
    try {
      await registrarCosto(orden.id, conceptoCosto, Number(valorCosto))
      setConceptoCosto('')
      setValorCosto('')
      recargar()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo registrar el costo.')
    } finally {
      setProcesando(false)
    }
  }

  if (cargando) {
    return <p className="cargando">Cargando orden…</p>
  }

  if (!orden) {
    return (
      <div className="pagina-detalle-orden">
        <p className="mensaje-error" role="alert">
          Esta orden no existe.
        </p>
        <button type="button" className="boton-secundario" onClick={() => navigate('/ordenes')}>
          Volver a órdenes
        </button>
      </div>
    )
  }

  const siguienteEstado = SIGUIENTE_ESTADO[orden.estado]

  return (
    <div className="pagina-detalle-orden">
      <div className="encabezado-seccion">
        <h1>Orden de {orden.cliente_nombre}</h1>
        <button type="button" className="boton-secundario" onClick={() => navigate('/ordenes')}>
          Volver a órdenes
        </button>
      </div>

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      <section className="formulario-panel">
        <p className="campo-solo-lectura">Cliente: <strong>{orden.cliente_nombre}</strong></p>
        {orden.cliente_telefono && (
          <p className="campo-solo-lectura">Teléfono: <strong>{orden.cliente_telefono}</strong></p>
        )}
        <p className="campo-solo-lectura">Encargo: {orden.descripcion}</p>
        <p className="campo-solo-lectura">Entrega estimada: {orden.fecha_entrega_estimada}</p>
        <p className="campo-solo-lectura">Estado: <strong>{ETIQUETA_ESTADO[orden.estado]}</strong></p>
        <p className="campo-solo-lectura">Costo total: {orden.costo_total}</p>
        <p className="campo-solo-lectura">Saldo pendiente: <strong>{orden.saldo_pendiente}</strong></p>

        {siguienteEstado && (
          <div className="acciones-formulario">
            {confirmandoEntrega ? (
              <>
                <p>Pasar a ENTREGADO descuenta el inventario de los consumos pendientes. ¿Continuar?</p>
                <button type="button" className="boton-secundario" onClick={() => setConfirmandoEntrega(false)}>
                  No
                </button>
                <button type="button" disabled={procesando} onClick={() => void manejarAvanzarEstado()}>
                  Sí, entregar
                </button>
              </>
            ) : (
              <button type="button" disabled={procesando} onClick={() => void manejarAvanzarEstado()}>
                Avanzar a {ETIQUETA_ESTADO[siguienteEstado]}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="formulario-panel">
        <h3>Abonos</h3>
        <table className="tabla-productos">
          <thead>
            <tr>
              <th>Valor</th>
              <th>Medio de pago</th>
              <th>Estado</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {orden.abonos.map((abono) => (
              <tr key={abono.id}>
                <td>{abono.valor}</td>
                <td>{ETIQUETA_MEDIO_PAGO[abono.medio_pago]}</td>
                <td>{ETIQUETA_ESTADO_PAGO[abono.estado_pago]}</td>
                <td>{abono.fecha}</td>
              </tr>
            ))}
            {orden.abonos.length === 0 && (
              <tr>
                <td colSpan={4} className="texto-vacio">Todavía no hay abonos.</td>
              </tr>
            )}
          </tbody>
        </table>

        <label htmlFor="orden-abono-valor">Valor del abono</label>
        <input
          id="orden-abono-valor"
          type="number"
          min="0.01"
          step="0.01"
          value={valorAbono}
          onChange={(evento) => setValorAbono(evento.target.value)}
        />
        <label htmlFor="orden-abono-medio">Medio de pago</label>
        <select
          id="orden-abono-medio"
          value={medioPagoAbono}
          onChange={(evento) => setMedioPagoAbono(evento.target.value as MedioPago)}
        >
          <option value="">Selecciona uno</option>
          {mediosHabilitados.map((medio) => (
            <option key={medio} value={medio}>{ETIQUETA_MEDIO_PAGO[medio]}</option>
          ))}
        </select>
        {(medioPagoAbono === 'TRANSFERENCIA' || medioPagoAbono === 'QR') && pagos?.nequi_llave && (
          <p className="campo-solo-lectura">
            Nequi {pagos.nequi_titular ?? ''}: <strong>{pagos.nequi_llave}</strong> — el abono queda
            pendiente de verificación, nunca como pagado.
          </p>
        )}
        <div className="acciones-formulario">
          <button type="button" disabled={procesando} onClick={() => void manejarAbono()}>
            Registrar abono
          </button>
        </div>
      </section>

      <section className="formulario-panel">
        <h3>Consumos</h3>
        <table className="tabla-productos">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {consumos.map((consumo) => (
              <tr key={consumo.id}>
                <td>{nombreProducto(consumo.producto_id)}</td>
                <td>{consumo.cantidad}</td>
                <td>{consumo.estado === 'APLICADO' ? 'Aplicado' : 'Pendiente'}</td>
              </tr>
            ))}
            {consumos.length === 0 && (
              <tr>
                <td colSpan={3} className="texto-vacio">Todavía no hay consumos.</td>
              </tr>
            )}
          </tbody>
        </table>

        {orden.estado !== 'ENTREGADO' && (
          <>
            <label htmlFor="orden-consumo-producto">Producto</label>
            <select
              id="orden-consumo-producto"
              value={productoConsumoId}
              onChange={(evento) => setProductoConsumoId(evento.target.value)}
            >
              <option value="">Selecciona uno</option>
              {productos.map((producto) => (
                <option key={producto.id} value={producto.id}>{producto.nombre}</option>
              ))}
            </select>
            <label htmlFor="orden-consumo-cantidad">Cantidad</label>
            <input
              id="orden-consumo-cantidad"
              type="number"
              min="0.01"
              step="0.01"
              value={cantidadConsumo}
              onChange={(evento) => setCantidadConsumo(evento.target.value)}
            />
            <div className="acciones-formulario">
              <button type="button" disabled={procesando} onClick={() => void manejarConsumo()}>
                Registrar consumo
              </button>
            </div>
          </>
        )}
      </section>

      {esAdmin && (
        <section className="formulario-panel">
          <h3>Costos operativos</h3>
          <p className="campo-solo-lectura">
            Utilidad neta: <strong>{utilidadNeta ?? orden.utilidad_neta}</strong>
          </p>
          <table className="tabla-productos">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {costos.map((costo) => (
                <tr key={costo.id}>
                  <td>{costo.concepto}</td>
                  <td>{costo.valor}</td>
                </tr>
              ))}
              {costos.length === 0 && (
                <tr>
                  <td colSpan={2} className="texto-vacio">Todavía no hay costos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>

          {orden.estado !== 'ENTREGADO' && (
            <>
              <label htmlFor="orden-costo-concepto">Concepto</label>
              <input
                id="orden-costo-concepto"
                value={conceptoCosto}
                onChange={(evento) => setConceptoCosto(evento.target.value)}
              />
              <label htmlFor="orden-costo-valor">Valor</label>
              <input
                id="orden-costo-valor"
                type="number"
                min="0.01"
                step="0.01"
                value={valorCosto}
                onChange={(evento) => setValorCosto(evento.target.value)}
              />
              <div className="acciones-formulario">
                <button type="button" disabled={procesando} onClick={() => void manejarCosto()}>
                  Registrar costo
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { listarPendientes, obtenerResumen } from '../api/caja'
import { crearCierre, listarCierres, obtenerVistaPreviaCierre } from '../api/cierres'
import { ErrorApi } from '../api/errorApi'
import { contarOperacionesPendientes } from '../sync/enrutador'
import { useEstadoLocal } from '../sync/useEstadoLocal'
import type {
  CierreCaja as CierreCajaTipo,
  MovimientoCaja,
  ResumenCaja,
  VistaPreviaCierre,
} from '../tipos/dominio'
import { fechaHoyBogota, formatoFecha, formatoFechaHora, formatoMoneda } from '../utilidades/formato'

/**
 * Resumen del día y cierre de caja (CU-15, CU-20, HU-027, HU-028) — solo
 * ADMIN. E-18: ya no es una página aparte; son las pestañas «Resumen del
 * día» (`vista="resumen"`) y «Cierre» (`vista="cierre"`) dentro de Caja.
 *
 * A5 (F-4/F-5, D28): la pestaña «Cierre» muestra lo que el servidor va a
 * consolidar (GET /api/cierres-caja/vista-previa/, mismo criterio D14) y los
 * cierres anteriores. La «Diferencia estimada» del arqueo es efectivo contado −
 * efectivo esperado de la vista previa: solo se muestra, nunca se envía; la
 * diferencia que vale es la que calcula el servidor al registrar.
 */
export function PanelCierreCaja({ vista }: { vista: 'resumen' | 'cierre' }) {
  const { enLinea } = useEstadoLocal()
  const [fecha, setFecha] = useState(fechaHoyBogota())
  const [resumen, setResumen] = useState<ResumenCaja | null>(null)
  const [pendientes, setPendientes] = useState<MovimientoCaja[]>([])
  const [vistaPrevia, setVistaPrevia] = useState<VistaPreviaCierre | null>(null)
  const [cierresAnteriores, setCierresAnteriores] = useState<CierreCajaTipo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [efectivoContado, setEfectivoContado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [errorCierre, setErrorCierre] = useState<string | null>(null)
  const [cierreRegistrado, setCierreRegistrado] = useState<CierreCajaTipo | null>(null)
  const [colaLocalPendiente, setColaLocalPendiente] = useState(0)

  /** Recarga los datos de la pestaña SIN borrar el mensaje de cierre registrado (F-4). */
  function cargarDatos() {
    if (!enLinea) {
      setCargando(false)
      return
    }
    setCargando(true)
    setError(null)
    const carga =
      vista === 'resumen'
        ? Promise.all([obtenerResumen(fecha), listarPendientes()]).then(([resumenObtenido, pendientesObtenidos]) => {
            setResumen(resumenObtenido)
            setPendientes(pendientesObtenidos)
          })
        : Promise.all([obtenerVistaPreviaCierre(), listarCierres(), contarOperacionesPendientes()]).then(
            ([previa, cierres, colaLocal]) => {
              setVistaPrevia(previa)
              setCierresAnteriores(cierres)
              setColaLocalPendiente(colaLocal)
            },
          )
    carga
      .catch((err: unknown) => {
        const porDefecto =
          vista === 'resumen' ? 'No se pudo cargar el resumen del día.' : 'No se pudo cargar lo que se va a cerrar.'
        setError(err instanceof ErrorApi ? err.message : porDefecto)
      })
      .finally(() => setCargando(false))
  }

  useEffect(cargarDatos, [fecha, vista, enLinea])

  function cambiarFecha(nueva: string) {
    setFecha(nueva)
    // F-4: el mensaje del último cierre se ve hasta cambiar la fecha o registrar otro.
    setCierreRegistrado(null)
  }

  const diferenciaEstimada =
    vistaPrevia && efectivoContado ? Number(efectivoContado) - vistaPrevia.efectivo_esperado : null

  async function manejarCierre(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!efectivoContado || colaLocalPendiente > 0) return
    setErrorCierre(null)
    setCierreRegistrado(null)
    setCerrando(true)
    try {
      const cierre = await crearCierre(fecha, Number(efectivoContado), observaciones || undefined)
      setCierreRegistrado(cierre)
      setEfectivoContado('')
      setObservaciones('')
      cargarDatos()
    } catch (err) {
      setErrorCierre(err instanceof ErrorApi ? err.message : 'No se pudo registrar el cierre.')
    } finally {
      setCerrando(false)
    }
  }

  return (
    <div className="panel-cierre-caja">
      <label htmlFor="cierre-fecha">Fecha</label>
      <input id="cierre-fecha" type="date" value={fecha} onChange={(evento) => cambiarFecha(evento.target.value)} />

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      {vista === 'resumen' &&
        (!enLinea ? (
          <p className="campo-solo-lectura">Requiere conexión.</p>
        ) : cargando ? (
          <p className="cargando">Cargando resumen del día…</p>
        ) : (
          resumen && (
            <section className="formulario-panel">
              <h3>Resumen del día</h3>
              <p className="campo-solo-lectura">Ingresos por ventas: {formatoMoneda(resumen.ingresos_ventas)}</p>
              <p className="campo-solo-lectura">Ingresos por abonos: {formatoMoneda(resumen.ingresos_abonos)}</p>
              <p className="campo-solo-lectura">Gastos: {formatoMoneda(resumen.gastos)}</p>
              <p className="campo-solo-lectura">Neto: <strong>{formatoMoneda(resumen.neto)}</strong></p>
              <p className="campo-solo-lectura">Efectivo (ingresos): {formatoMoneda(resumen.por_medio_pago.EFECTIVO)}</p>
              <p className="campo-solo-lectura">
                Transferencia (ingresos): {formatoMoneda(resumen.por_medio_pago.TRANSFERENCIA)}
              </p>
              <p className="campo-solo-lectura">QR (ingresos): {formatoMoneda(resumen.por_medio_pago.QR)}</p>
              <p className="campo-solo-lectura">
                Pendiente de verificación (no entra al cierre): {formatoMoneda(resumen.pendiente_verificacion)}
              </p>

              {pendientes.length > 0 && (
                <p className="mensaje-error" role="alert">
                  Hay {pendientes.length} cobro(s) pendiente(s) de verificación — quedan fuera de este cierre
                  hasta confirmarse.
                </p>
              )}
            </section>
          )
        ))}

      {vista === 'cierre' && (
        <>
          {!enLinea ? (
            <p className="campo-solo-lectura">Requiere conexión.</p>
          ) : cargando && !vistaPrevia ? (
            <p className="cargando">Cargando lo que se va a cerrar…</p>
          ) : (
            vistaPrevia && (
              <section className="formulario-panel">
                <h3>Lo que se va a cerrar</h3>
                <p className="campo-solo-lectura">
                  Período: desde {formatoFechaHora(vistaPrevia.periodo_inicio)} hasta ahora
                </p>
                <p className="campo-solo-lectura">
                  Ingresos por ventas: {formatoMoneda(vistaPrevia.total_ingresos_ventas)}
                </p>
                <p className="campo-solo-lectura">
                  Ingresos por abonos: {formatoMoneda(vistaPrevia.total_ingresos_abonos)}
                </p>
                <p className="campo-solo-lectura">Gastos: {formatoMoneda(vistaPrevia.total_gastos)}</p>
                <p className="campo-solo-lectura">Neto: <strong>{formatoMoneda(vistaPrevia.total_neto)}</strong></p>
                <p className="campo-solo-lectura">
                  Efectivo esperado: <strong>{formatoMoneda(vistaPrevia.efectivo_esperado)}</strong>
                </p>
                <p className="campo-solo-lectura">
                  El cierre incluye todos los movimientos confirmados que aún no se han cerrado, aunque sean de
                  días anteriores.
                </p>
              </section>
            )
          )}

          {colaLocalPendiente > 0 && (
            <p className="mensaje-error" role="alert">
              Hay {colaLocalPendiente} operación(es) de este dispositivo sin sincronizar (E-05): el cierre no se
              puede confirmar hasta que se apliquen. El arqueo se puede preparar y contar igual.
            </p>
          )}

          <section className="formulario-panel">
            <h3>Arqueo</h3>
            <form onSubmit={manejarCierre}>
              <label htmlFor="cierre-efectivo-contado">Efectivo contado</label>
              <input
                id="cierre-efectivo-contado"
                type="number"
                min="0"
                step="0.01"
                value={efectivoContado}
                onChange={(evento) => setEfectivoContado(evento.target.value)}
                required
              />

              {diferenciaEstimada !== null && (
                <p className="campo-solo-lectura">
                  Diferencia estimada: <strong>{formatoMoneda(diferenciaEstimada)}</strong>
                  {diferenciaEstimada !== 0 && ' — las observaciones son obligatorias.'}
                </p>
              )}

              <label htmlFor="cierre-observaciones">
                Observaciones{diferenciaEstimada !== 0 && diferenciaEstimada !== null && ' (obligatorio)'}
              </label>
              <textarea
                id="cierre-observaciones"
                value={observaciones}
                onChange={(evento) => setObservaciones(evento.target.value)}
                required={diferenciaEstimada !== null && diferenciaEstimada !== 0}
              />

              {errorCierre && (
                <p className="mensaje-error" role="alert">
                  {errorCierre}
                </p>
              )}
              {cierreRegistrado && (
                <p className="campo-solo-lectura" role="status">
                  Cierre registrado. Diferencia final: <strong>{formatoMoneda(cierreRegistrado.diferencia)}</strong>
                </p>
              )}

              <div className="acciones-formulario">
                <button type="submit" disabled={cerrando || colaLocalPendiente > 0 || !enLinea}>
                  {!enLinea ? 'Requiere conexión' : cerrando ? 'Cerrando…' : 'Registrar cierre'}
                </button>
              </div>
            </form>
          </section>

          <section className="formulario-panel panel-cierres-anteriores">
            <h3>Cierres anteriores</h3>
            {!enLinea ? (
              <p className="campo-solo-lectura">Requiere conexión.</p>
            ) : (
              <table className="tabla-productos">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Efectivo esperado</th>
                    <th>Efectivo contado</th>
                    <th>Diferencia</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cierresAnteriores.map((cierre) => (
                    <tr key={cierre.id}>
                      <td>{formatoFecha(cierre.fecha)}</td>
                      <td>{formatoMoneda(cierre.efectivo_esperado)}</td>
                      <td>{formatoMoneda(cierre.efectivo_contado)}</td>
                      <td>{formatoMoneda(cierre.diferencia)}</td>
                      <td>{cierre.observaciones || '—'}</td>
                    </tr>
                  ))}
                  {cierresAnteriores.length === 0 && (
                    <tr>
                      <td colSpan={5} className="texto-vacio">
                        Todavía no hay cierres registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  )
}

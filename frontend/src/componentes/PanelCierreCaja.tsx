import { useEffect, useState, type FormEvent } from 'react'
import { listarPendientes, obtenerResumen } from '../api/caja'
import { crearCierre } from '../api/cierres'
import { ErrorApi } from '../api/errorApi'
import { contarOperacionesPendientes } from '../sync/enrutador'
import { useEstadoLocal } from '../sync/useEstadoLocal'
import type { CierreCaja as CierreCajaTipo, MovimientoCaja, ResumenCaja } from '../tipos/dominio'
import { formatoMoneda } from '../utilidades/formato'

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Resumen del día y cierre de caja (CU-15, CU-20, HU-027, HU-028) — solo
 * ADMIN. E-18: ya no es una página aparte; son las pestañas «Resumen del
 * día» (`vista="resumen"`) y «Cierre» (`vista="cierre"`) dentro de Caja.
 */
export function PanelCierreCaja({ vista }: { vista: 'resumen' | 'cierre' }) {
  const { enLinea } = useEstadoLocal()
  const [fecha, setFecha] = useState(fechaHoy())
  const [resumen, setResumen] = useState<ResumenCaja | null>(null)
  const [pendientes, setPendientes] = useState<MovimientoCaja[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [efectivoContado, setEfectivoContado] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [errorCierre, setErrorCierre] = useState<string | null>(null)
  const [cierreRegistrado, setCierreRegistrado] = useState<CierreCajaTipo | null>(null)
  const [colaLocalPendiente, setColaLocalPendiente] = useState(0)

  function recargar() {
    setCargando(true)
    setError(null)
    setCierreRegistrado(null)
    Promise.all([obtenerResumen(fecha), listarPendientes(), contarOperacionesPendientes()])
      .then(([resumenObtenido, pendientesObtenidos, colaLocal]) => {
        setResumen(resumenObtenido)
        setPendientes(pendientesObtenidos)
        setColaLocalPendiente(colaLocal)
      })
      .catch((err: unknown) => {
        setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el resumen del día.')
      })
      .finally(() => setCargando(false))
  }

  useEffect(recargar, [fecha])

  const diferenciaEstimada =
    resumen && efectivoContado ? Number(efectivoContado) - resumen.por_medio_pago.EFECTIVO : null

  async function manejarCierre(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!efectivoContado || colaLocalPendiente > 0) return
    setErrorCierre(null)
    setCerrando(true)
    try {
      const cierre = await crearCierre(fecha, Number(efectivoContado), observaciones || undefined)
      setCierreRegistrado(cierre)
      setEfectivoContado('')
      setObservaciones('')
      recargar()
    } catch (err) {
      setErrorCierre(err instanceof ErrorApi ? err.message : 'No se pudo registrar el cierre.')
    } finally {
      setCerrando(false)
    }
  }

  return (
    <div className="panel-cierre-caja">
      <label htmlFor="cierre-fecha">Fecha</label>
      <input
        id="cierre-fecha"
        type="date"
        value={fecha}
        onChange={(evento) => setFecha(evento.target.value)}
      />

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      {vista === 'resumen' && (cargando ? (
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

      {vista === 'cierre' && resumen && (
        <p className="campo-solo-lectura">
          Efectivo (ingresos) del día: <strong>{formatoMoneda(resumen.por_medio_pago.EFECTIVO)}</strong>
        </p>
      )}

      {vista === 'cierre' && colaLocalPendiente > 0 && (
        <p className="mensaje-error" role="alert">
          Hay {colaLocalPendiente} operación(es) de este dispositivo sin sincronizar (E-05): el cierre no se
          puede confirmar hasta que se apliquen. El arqueo se puede preparar y contar igual.
        </p>
      )}

      {vista === 'cierre' && (
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
            <p className="campo-solo-lectura">
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
      )}
    </div>
  )
}

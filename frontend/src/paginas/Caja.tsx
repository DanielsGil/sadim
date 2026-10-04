import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  anularMovimiento,
  confirmarMovimiento,
  listarPendientes,
  operationIdsSinSincronizar,
  registrarGasto,
} from '../api/caja'
import { obtenerConfiguracionPagos } from '../api/configuracion'
import { mensajeErrorApi } from '../api/errorApi'
import { AvisoCopiaLocal } from '../componentes/AvisoLocal'
import { PanelCierreCaja } from '../componentes/PanelCierreCaja'
import { useSesion } from '../contexto/SesionContext'
import { useEstadoLocal } from '../sync/useEstadoLocal'
import type { ConfiguracionPago, MedioPago, MovimientoCaja } from '../tipos/dominio'
import { formatoFechaHora, formatoMoneda } from '../utilidades/formato'

const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
}

const ETIQUETA_TIPO: Record<string, string> = {
  INGRESO_VENTA: 'Venta',
  INGRESO_ABONO: 'Abono',
  GASTO: 'Gasto',
}

type PestanaCaja = 'gastos' | 'pendientes' | 'resumen' | 'cierre'

/**
 * Caja (CU-14, CU-15, CU-20, HU-027..HU-029, HU-050). E-18: una sola
 * sección con pestañas — «Gastos» y «Pagos pendientes» para ambos roles;
 * «Resumen del día» y «Cierre» solo ADMIN (antes /caja/cierre, que ahora
 * redirige aquí con ?pestana=cierre). Los permisos reales siguen en el backend.
 */
export function Caja() {
  const { sesion } = useSesion()
  const esAdmin = sesion?.rol === 'ADMIN'
  const { enLinea } = useEstadoLocal()

  const pestanas: Array<{ valor: PestanaCaja; etiqueta: string }> = [
    { valor: 'gastos', etiqueta: 'Gastos' },
    { valor: 'pendientes', etiqueta: 'Pagos pendientes' },
    ...(esAdmin
      ? [
          { valor: 'resumen' as const, etiqueta: 'Resumen del día' },
          { valor: 'cierre' as const, etiqueta: 'Cierre' },
        ]
      : []),
  ]
  const [parametros, setParametros] = useSearchParams()
  const pedida = parametros.get('pestana')
  const pestana: PestanaCaja = pestanas.some((p) => p.valor === pedida) ? (pedida as PestanaCaja) : 'gastos'

  const [pagos, setPagos] = useState<ConfiguracionPago | null>(null)
  const [medioPago, setMedioPago] = useState<MedioPago | ''>('')
  const [valor, setValor] = useState('')
  const [concepto, setConcepto] = useState('')
  const [guardandoGasto, setGuardandoGasto] = useState(false)
  const [errorGasto, setErrorGasto] = useState<string | null>(null)
  const [mensajeGasto, setMensajeGasto] = useState<string | null>(null)

  const [pendientes, setPendientes] = useState<MovimientoCaja[]>([])
  const [sinSincronizar, setSinSincronizar] = useState<Set<string>>(new Set())
  const [cargandoPendientes, setCargandoPendientes] = useState(true)
  const [errorPendientes, setErrorPendientes] = useState<string | null>(null)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [motivoAnulacion, setMotivoAnulacion] = useState<Record<string, string>>({})

  useEffect(() => {
    obtenerConfiguracionPagos().then(setPagos)
  }, [])

  function recargarPendientes() {
    setCargandoPendientes(true)
    setErrorPendientes(null)
    listarPendientes()
      .then(async (lista) => {
        setPendientes(lista)
        setSinSincronizar(await operationIdsSinSincronizar())
      })
      .catch((err: unknown) => {
        setErrorPendientes(mensajeErrorApi(err, 'No se pudieron cargar los pagos pendientes.'))
      })
      .finally(() => setCargandoPendientes(false))
  }

  useEffect(recargarPendientes, [])

  const mediosHabilitados: MedioPago[] = pagos
    ? [
        ...(pagos.acepta_efectivo ? (['EFECTIVO'] as const) : []),
        ...(pagos.acepta_transferencia ? (['TRANSFERENCIA'] as const) : []),
        ...(pagos.acepta_qr ? (['QR'] as const) : []),
      ]
    : []

  async function manejarGasto(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!medioPago || !valor || !concepto) return
    setErrorGasto(null)
    setMensajeGasto(null)
    setGuardandoGasto(true)
    try {
      const movimiento = await registrarGasto(medioPago, Number(valor), concepto)
      setMensajeGasto(
        movimiento.estado_pago === 'PENDIENTE_VERIFICACION'
          ? 'Gasto registrado, pendiente de verificación.'
          : 'Gasto registrado.',
      )
      setValor('')
      setConcepto('')
      recargarPendientes()
    } catch (err) {
      setErrorGasto(mensajeErrorApi(err, 'No se pudo registrar el gasto.'))
    } finally {
      setGuardandoGasto(false)
    }
  }

  async function manejarConfirmar(movimiento: MovimientoCaja) {
    setProcesandoId(movimiento.id)
    setErrorPendientes(null)
    try {
      await confirmarMovimiento(movimiento.id)
      recargarPendientes()
    } catch (err) {
      setErrorPendientes(mensajeErrorApi(err, 'No se pudo confirmar el pago.'))
    } finally {
      setProcesandoId(null)
    }
  }

  async function manejarAnular(movimiento: MovimientoCaja) {
    const motivo = motivoAnulacion[movimiento.id]
    if (!motivo) return
    setProcesandoId(movimiento.id)
    setErrorPendientes(null)
    try {
      await anularMovimiento(movimiento.id, motivo)
      recargarPendientes()
    } catch (err) {
      setErrorPendientes(mensajeErrorApi(err, 'No se pudo anular el pago.'))
    } finally {
      setProcesandoId(null)
    }
  }

  return (
    <div className="pagina-caja">
      <h1>Caja</h1>
      <AvisoCopiaLocal enLinea={enLinea} />

      <div className="pestanas pestanas-caja" role="tablist">
        {pestanas.map((p) => (
          <button
            key={p.valor}
            type="button"
            role="tab"
            aria-selected={pestana === p.valor}
            className={`pestana ${pestana === p.valor ? 'pestana-activa' : ''}`}
            onClick={() => setParametros({ pestana: p.valor }, { replace: true })}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'gastos' && (
      <section className="formulario-panel">
        <h3>Registrar gasto</h3>
        <form onSubmit={manejarGasto}>
          <label htmlFor="gasto-medio-pago">Medio de pago</label>
          <select
            id="gasto-medio-pago"
            value={medioPago}
            onChange={(evento) => setMedioPago(evento.target.value as MedioPago)}
            required
          >
            <option value="">Selecciona uno</option>
            {mediosHabilitados.map((medio) => (
              <option key={medio} value={medio}>{ETIQUETA_MEDIO_PAGO[medio]}</option>
            ))}
          </select>

          <label htmlFor="gasto-valor">Valor</label>
          <input
            id="gasto-valor"
            type="number"
            min="0.01"
            step="0.01"
            value={valor}
            onChange={(evento) => setValor(evento.target.value)}
            required
          />

          <label htmlFor="gasto-concepto">Concepto</label>
          <input
            id="gasto-concepto"
            value={concepto}
            onChange={(evento) => setConcepto(evento.target.value)}
            placeholder="Compra de bolsas…"
            required
          />

          {mensajeGasto && <p className="campo-solo-lectura">{mensajeGasto}</p>}
          {errorGasto && (
            <p className="mensaje-error" role="alert">
              {errorGasto}
            </p>
          )}

          <div className="acciones-formulario">
            <button type="submit" disabled={guardandoGasto}>
              {guardandoGasto ? 'Registrando…' : 'Registrar gasto'}
            </button>
          </div>
        </form>
      </section>
      )}

      {pestana === 'pendientes' && (
      <section className="formulario-panel panel-pagos-pendientes">
        <h3>Pagos pendientes de verificación</h3>
        {errorPendientes && (
          <p className="mensaje-error" role="alert">
            {errorPendientes}
          </p>
        )}
        {cargandoPendientes ? (
          <p className="cargando">Cargando pagos pendientes…</p>
        ) : (
          <table className="tabla-productos">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Medio de pago</th>
                <th>Valor</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pendientes.map((movimiento) => (
                <tr key={movimiento.id}>
                  <td>{ETIQUETA_TIPO[movimiento.tipo] ?? movimiento.tipo}</td>
                  <td>{ETIQUETA_MEDIO_PAGO[movimiento.medio_pago]}</td>
                  <td>{formatoMoneda(movimiento.valor)}</td>
                  <td>{formatoFechaHora(movimiento.fecha)}</td>
                  <td className="celda-acciones">
                    <button
                      type="button"
                      disabled={procesandoId === movimiento.id || !enLinea || sinSincronizar.has(movimiento.operation_id)}
                      onClick={() => void manejarConfirmar(movimiento)}
                    >
                      {!enLinea ? 'Requiere conexión' : sinSincronizar.has(movimiento.operation_id) ? 'Pendiente de sincronizar' : 'Confirmar'}
                    </button>
                    {esAdmin && (
                      <>
                        <input
                          placeholder="Motivo de anulación"
                          value={motivoAnulacion[movimiento.id] ?? ''}
                          onChange={(evento) =>
                            setMotivoAnulacion({ ...motivoAnulacion, [movimiento.id]: evento.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="boton-secundario"
                          disabled={
                            procesandoId === movimiento.id ||
                            !motivoAnulacion[movimiento.id] ||
                            !enLinea ||
                            sinSincronizar.has(movimiento.operation_id)
                          }
                          onClick={() => void manejarAnular(movimiento)}
                        >
                          {!enLinea ? 'Requiere conexión' : 'Anular'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {pendientes.length === 0 && (
                <tr>
                  <td colSpan={5} className="texto-vacio">No hay pagos pendientes de verificación.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
      )}

      {esAdmin && (pestana === 'resumen' || pestana === 'cierre') && <PanelCierreCaja vista={pestana} />}
    </div>
  )
}

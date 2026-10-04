import { useEffect, useState } from 'react'
import { ErrorApi } from '../api/errorApi'
import { listarNovedades, marcarNovedadAtendida } from '../api/novedades'
import { baseLocal } from '../db/baseLocal'
import { estaEnLinea } from '../sync/cacheCatalogo'
import type { Novedad } from '../tipos/dominio'
import { formatoFechaHora } from '../utilidades/formato'

/**
 * Novedades (HU-052): resultados RECHAZADA/CONFLICTO de /api/sync/. Ambos
 * roles pueden verlas; marcar como atendida requiere conexión (D-05).
 */
export function Novedades() {
  const [novedades, setNovedades] = useState<Novedad[]>([])
  const [soloPendientes, setSoloPendientes] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enLinea, setEnLinea] = useState(estaEnLinea())

  function recargar() {
    setCargando(true)
    setError(null)
    listarNovedades({ atendida: soloPendientes ? false : undefined })
      .then((datos) => {
        setNovedades(datos)
        setEnLinea(true)
      })
      .catch(async (err: unknown) => {
        if (estaEnLinea()) {
          setError(err instanceof ErrorApi ? err.message : 'No se pudieron cargar las novedades.')
          return
        }
        setEnLinea(false)
        const locales = await baseLocal.novedades.toArray()
        setNovedades(soloPendientes ? locales.filter((novedad) => !novedad.atendida) : locales)
      })
      .finally(() => setCargando(false))
  }

  useEffect(recargar, [soloPendientes])

  async function manejarAtendida(id: string) {
    try {
      await marcarNovedadAtendida(id, true)
      recargar()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo marcar como atendida (requiere conexión).')
    }
  }

  return (
    <div className="pagina-novedades">
      <div className="encabezado-seccion">
        <h1>Novedades</h1>
        <label>
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={(evento) => setSoloPendientes(evento.target.checked)}
          />{' '}
          Solo pendientes
        </label>
      </div>

      {!enLinea && (
        <p className="campo-solo-lectura">
          Sin conexión: mostrando la copia local. Los datos pueden no estar actualizados.
        </p>
      )}

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : (
        <table className="tabla-productos">
          <thead>
            <tr>
              <th>Recurso</th>
              <th>Código</th>
              <th>Mensaje</th>
              <th>Fecha en el dispositivo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {novedades.map((novedad) => (
              <tr key={novedad.operation_id}>
                <td>{novedad.recurso}</td>
                <td>{novedad.codigo_conflicto ?? '—'}</td>
                <td>{novedad.mensaje ?? '—'}</td>
                <td>{formatoFechaHora(novedad.fecha_cliente)}</td>
                <td>
                  {!novedad.atendida && (
                    <button type="button" onClick={() => void manejarAtendida(novedad.id)} disabled={!enLinea}>
                      Marcar atendida
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {novedades.length === 0 && (
              <tr>
                <td colSpan={5} className="texto-vacio">
                  No hay novedades.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

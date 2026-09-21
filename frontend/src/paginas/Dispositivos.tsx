import { useEffect, useState } from 'react'
import {
  autorizarDispositivo,
  desactivarDispositivo,
  listarDispositivos,
  registrarDispositivo,
} from '../api/dispositivos'
import { ErrorApi } from '../api/errorApi'
import { obtenerOCrearDeviceId } from '../db/baseLocal'
import type { Dispositivo } from '../tipos/dominio'

/**
 * Dispositivos (HU-051, Contrato v2 §4.1). Solo ADMIN, requiere conexión
 * (E-04): autorizar/revocar offline permitiría que dos dispositivos se
 * autorizaran a sí mismos, justo lo que D-04 evita.
 */
export function Dispositivos() {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [esteId, setEsteId] = useState('')
  const [nombre, setNombre] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)

  function recargar() {
    setCargando(true)
    setError(null)
    listarDispositivos()
      .then(setDispositivos)
      .catch((err: unknown) => setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar la lista.'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    obtenerOCrearDeviceId().then(setEsteId)
    recargar()
  }, [])

  const esteRegistrado = dispositivos.some((dispositivo) => dispositivo.identificador === esteId)

  async function manejarRegistrar() {
    if (!nombre.trim()) return
    setProcesando(true)
    setError(null)
    try {
      await registrarDispositivo(esteId, nombre.trim())
      setNombre('')
      recargar()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo registrar el dispositivo.')
    } finally {
      setProcesando(false)
    }
  }

  async function manejarAutorizar(id: string, autorizar: boolean) {
    setProcesando(true)
    setError(null)
    try {
      await autorizarDispositivo(id, autorizar)
      recargar()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo actualizar el dispositivo.')
    } finally {
      setProcesando(false)
    }
  }

  async function manejarDesactivar(id: string) {
    setProcesando(true)
    setError(null)
    try {
      await desactivarDispositivo(id)
      recargar()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo desactivar el dispositivo.')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <div className="pagina-dispositivos">
      <div className="encabezado-seccion">
        <h1>Dispositivos</h1>
      </div>

      <p className="campo-solo-lectura">
        Este dispositivo {esteRegistrado ? 'ya está registrado' : 'todavía no está registrado'}.
        {esteRegistrado ? '' : ' Regístralo para poder autorizarlo a trabajar sin conexión.'}
      </p>

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      {!esteRegistrado && (
        <section className="formulario-panel">
          <h3>Registrar este dispositivo</h3>
          <label htmlFor="dispositivo-nombre">Nombre</label>
          <input
            id="dispositivo-nombre"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            placeholder="Ej. Caja principal"
          />
          <div className="acciones-formulario">
            <button type="button" disabled={procesando} onClick={() => void manejarRegistrar()}>
              Registrar este dispositivo
            </button>
          </div>
        </section>
      )}

      {cargando ? (
        <p className="cargando">Cargando…</p>
      ) : (
        <table className="tabla-productos">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Autorizado offline</th>
              <th>Activo</th>
              <th>Última sincronización</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {dispositivos.map((dispositivo) => (
              <tr key={dispositivo.id}>
                <td>
                  {dispositivo.nombre}
                  {dispositivo.identificador === esteId ? ' (este dispositivo)' : ''}
                </td>
                <td>{dispositivo.autorizado_offline ? 'Sí' : 'No'}</td>
                <td>{dispositivo.activo ? 'Sí' : 'No'}</td>
                <td>{dispositivo.ultima_sincronizacion ?? '—'}</td>
                <td>
                  {dispositivo.activo && !dispositivo.autorizado_offline && (
                    <button
                      type="button"
                      disabled={procesando}
                      onClick={() => void manejarAutorizar(dispositivo.id, true)}
                    >
                      Autorizar
                    </button>
                  )}
                  {dispositivo.activo && dispositivo.autorizado_offline && (
                    <button
                      type="button"
                      className="boton-secundario"
                      disabled={procesando}
                      onClick={() => void manejarAutorizar(dispositivo.id, false)}
                    >
                      Revocar
                    </button>
                  )}
                  {dispositivo.activo && (
                    <button
                      type="button"
                      className="boton-secundario"
                      disabled={procesando}
                      onClick={() => void manejarDesactivar(dispositivo.id)}
                    >
                      Desactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {dispositivos.length === 0 && (
              <tr>
                <td colSpan={5} className="texto-vacio">
                  No hay dispositivos registrados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

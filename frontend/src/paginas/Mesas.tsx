import { useEffect, useState } from 'react'
import { cambiarActivaMesa, listarMesas } from '../api/mesas'
import { ErrorApi } from '../api/errorApi'
import { FormularioMesa } from '../componentes/FormularioMesa'
import type { Mesa } from '../tipos/dominio'

/** Gestión de mesas (CU-19, HU-043) — solo ADMIN. */
export function Mesas() {
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formulario, setFormulario] = useState(false)

  function recargar() {
    setCargando(true)
    listarMesas()
      .then(setMesas)
      .catch((err: unknown) => {
        setError(err instanceof ErrorApi ? err.message : 'No se pudieron cargar las mesas.')
      })
      .finally(() => setCargando(false))
  }

  useEffect(recargar, [])

  async function alternarActiva(mesa: Mesa) {
    setError(null)
    try {
      const actualizada = await cambiarActivaMesa(mesa.id, !mesa.activa)
      setMesas((actuales) => actuales.map((m) => (m.id === actualizada.id ? actualizada : m)))
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar el estado de la mesa.')
    }
  }

  return (
    <div className="pagina-mesas">
      <div className="encabezado-seccion">
        <h1>Mesas</h1>
        <button type="button" onClick={() => setFormulario(true)}>
          Nueva mesa
        </button>
      </div>

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="cargando">Cargando mesas…</p>
      ) : (
        <table className="tabla-productos">
          <thead>
            <tr>
              <th>Número</th>
              <th>Estado</th>
              <th>Activa</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {mesas.map((mesa) => (
              <tr key={mesa.id} className={mesa.activa ? '' : 'fila-inactiva'}>
                <td>{mesa.numero}</td>
                <td>{mesa.estado === 'OCUPADA' ? 'Ocupada' : 'Disponible'}</td>
                <td>
                  <span className={mesa.activa ? 'insignia-activo' : 'insignia-inactivo'}>
                    {mesa.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="celda-acciones">
                  <button
                    type="button"
                    className="boton-secundario"
                    onClick={() => void alternarActiva(mesa)}
                    disabled={mesa.estado === 'OCUPADA' && mesa.activa}
                    title={
                      mesa.estado === 'OCUPADA' && mesa.activa
                        ? 'No se puede desactivar una mesa con una sesión abierta'
                        : undefined
                    }
                  >
                    {mesa.activa ? 'Desactivar' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
            {mesas.length === 0 && (
              <tr>
                <td colSpan={4} className="texto-vacio">
                  Todavía no hay mesas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {formulario && (
        <FormularioMesa
          onCancelar={() => setFormulario(false)}
          onGuardado={() => {
            setFormulario(false)
            recargar()
          }}
        />
      )}
    </div>
  )
}

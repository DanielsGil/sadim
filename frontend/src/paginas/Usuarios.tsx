import { useEffect, useState } from 'react'
import { cambiarActivoUsuario, listarUsuarios } from '../api/usuarios'
import { ErrorApi } from '../api/errorApi'
import { FormularioUsuario } from '../componentes/FormularioUsuario'
import type { Usuario } from '../tipos/dominio'

const ETIQUETA_ROL: Record<Usuario['rol'], string> = {
  ADMIN: 'Administrador',
  OPERADOR: 'Operador',
}

/** Usuarios (CU-18, HU-044) — solo ADMIN. */
export function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<'nuevo' | Usuario | null>(null)

  useEffect(() => {
    listarUsuarios()
      .then(setUsuarios)
      .catch((err: unknown) => {
        setError(err instanceof ErrorApi ? err.message : 'No se pudieron cargar los usuarios.')
      })
      .finally(() => setCargando(false))
  }, [])

  async function alternarActivo(usuario: Usuario) {
    setError(null)
    try {
      const actualizado = await cambiarActivoUsuario(usuario.id, !usuario.activo)
      setUsuarios((actuales) => actuales.map((u) => (u.id === actualizado.id ? actualizado : u)))
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cambiar el estado del usuario.')
    }
  }

  return (
    <div className="pagina-usuarios">
      <div className="encabezado-seccion">
        <h1>Usuarios</h1>
        <button type="button" onClick={() => setFormulario('nuevo')}>
          Nuevo operador
        </button>
      </div>

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="cargando">Cargando usuarios…</p>
      ) : (
        <table className="tabla-productos">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id} className={usuario.activo ? '' : 'fila-inactiva'}>
                <td>{usuario.nombre_completo}</td>
                <td>{usuario.username}</td>
                <td>{ETIQUETA_ROL[usuario.rol]}</td>
                <td>
                  <span className={usuario.activo ? 'insignia-activo' : 'insignia-inactivo'}>
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="celda-acciones">
                  <button
                    type="button"
                    className="boton-secundario"
                    onClick={() => setFormulario(usuario)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="boton-secundario"
                    onClick={() => alternarActivo(usuario)}
                    // R-04: no se puede desactivar al único ADMIN activo; el
                    // backend lo rechaza igual (409 ULTIMO_ADMIN_ACTIVO), pero
                    // esto evita el intento innecesario.
                    disabled={usuario.rol === 'ADMIN' && usuario.activo}
                    title={
                      usuario.rol === 'ADMIN' && usuario.activo
                        ? 'No se puede desactivar al único administrador'
                        : undefined
                    }
                  >
                    {usuario.activo ? 'Desactivar' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={5} className="texto-vacio">
                  Todavía no hay usuarios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {formulario && (
        <FormularioUsuario
          usuarioInicial={formulario === 'nuevo' ? undefined : formulario}
          onCancelar={() => setFormulario(null)}
          onGuardado={(usuario) => {
            setUsuarios((actuales) => {
              const existe = actuales.some((u) => u.id === usuario.id)
              return existe
                ? actuales.map((u) => (u.id === usuario.id ? usuario : u))
                : [...actuales, usuario]
            })
            setFormulario(null)
          }}
        />
      )}
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { crearUsuario, editarUsuario } from '../api/usuarios'
import { ErrorApi } from '../api/errorApi'
import type { Usuario } from '../tipos/dominio'

interface Props {
  usuarioInicial?: Usuario
  onGuardado: (usuario: Usuario) => void
  onCancelar: () => void
}

/**
 * Crear Operador / editar usuario — CU-18, HU-044. POST siempre crea
 * OPERADOR: este formulario no ofrece elegir rol. En edición, el username
 * no se puede cambiar y la contraseña es opcional (dejarla vacía la
 * conserva).
 */
export function FormularioUsuario({ usuarioInicial, onGuardado, onCancelar }: Props) {
  const [nombreCompleto, setNombreCompleto] = useState(usuarioInicial?.nombre_completo ?? '')
  const [username, setUsername] = useState(usuarioInicial?.username ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const usuario = usuarioInicial
        ? await editarUsuario(usuarioInicial.id, {
            nombre_completo: nombreCompleto,
            ...(password ? { password } : {}),
          })
        : await crearUsuario({ nombre_completo: nombreCompleto, username, password })
      onGuardado(usuario)
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el usuario.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className="formulario-panel" onSubmit={manejarEnvio}>
      <h3>{usuarioInicial ? 'Editar usuario' : 'Nuevo operador'}</h3>

      <label htmlFor="usuario-nombre">Nombre completo</label>
      <input
        id="usuario-nombre"
        value={nombreCompleto}
        onChange={(evento) => setNombreCompleto(evento.target.value)}
        required
      />

      <label htmlFor="usuario-username">Usuario</label>
      <input
        id="usuario-username"
        value={username}
        onChange={(evento) => setUsername(evento.target.value)}
        disabled={Boolean(usuarioInicial)}
        required
      />

      <label htmlFor="usuario-password">
        {usuarioInicial ? 'Nueva contraseña (dejar en blanco para no cambiarla)' : 'Contraseña'}
      </label>
      <input
        id="usuario-password"
        type="password"
        value={password}
        onChange={(evento) => setPassword(evento.target.value)}
        required={!usuarioInicial}
      />

      {error && (
        <p className="mensaje-error" role="alert">
          {error}
        </p>
      )}

      <div className="acciones-formulario">
        <button type="button" className="boton-secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

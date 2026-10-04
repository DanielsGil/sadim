import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ErrorApi } from '../api/errorApi'
import { ErrorColaDeOtroUsuario } from '../contexto/erroresSesion'
import { useSesion } from '../contexto/SesionContext'

/**
 * A4 (F-3): mensaje según la causa, distinguida por tipo y no por texto.
 * - ErrorApi: el mensaje del servidor (p. ej. CREDENCIALES_INVALIDAS, que ya
 *   unifica usuario inexistente, contraseña incorrecta y usuario inactivo).
 * - D21 (otro usuario con operaciones en cola): su propio mensaje.
 * - Sin red: `fetch` lanza TypeError, o el navegador ya sabe que está offline.
 */
function mensajeErrorLogin(err: unknown): string {
  if (err instanceof ErrorApi) return err.message
  if (err instanceof ErrorColaDeOtroUsuario) return err.message
  if (!navigator.onLine || err instanceof TypeError) {
    return 'No hay conexión. El primer inicio de sesión necesita internet.'
  }
  return 'No se pudo iniciar sesión.'
}

/** Inicio de sesión — wireframe 1, CU-17. */
export function Login() {
  const { sesion, iniciarSesion } = useSesion()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (sesion) {
    return <Navigate to="/" replace />
  }

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await iniciarSesion(username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(mensajeErrorLogin(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pantalla-login">
      <form className="tarjeta-login" onSubmit={manejarEnvio}>
        <h1>SADIM</h1>
        <p className="subtitulo">Inicia sesión para continuar</p>

        <label htmlFor="campo-username">Usuario</label>
        <input
          id="campo-username"
          value={username}
          onChange={(evento) => setUsername(evento.target.value)}
          autoComplete="username"
          required
        />

        <label htmlFor="campo-password">Contraseña</label>
        <input
          id="campo-password"
          type="password"
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
          autoComplete="current-password"
          required
        />

        {error && (
          <p className="mensaje-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

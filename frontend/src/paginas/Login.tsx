import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ErrorApi } from '../api/errorApi'
import { useSesion } from '../contexto/SesionContext'

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
      // El backend ya unifica usuario inexistente, contraseña incorrecta y
      // usuario inactivo en un solo mensaje genérico (CREDENCIALES_INVALIDAS).
      setError(err instanceof ErrorApi ? err.message : 'No se pudo iniciar sesión.')
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

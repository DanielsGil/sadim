import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesion } from '../contexto/SesionContext'
import { almacenBloqueoDexie } from '../db/baseLocal'
import { IndicadorConectividad } from './IndicadorConectividad'

function textoEspera(ms: number): string {
  const segundos = Math.ceil(ms / 1000)
  if (segundos < 60) return `${segundos} s`
  const minutos = Math.floor(segundos / 60)
  const resto = segundos % 60
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`
}

/**
 * D30 (E-22): pantalla de bloqueo. Reemplaza TODO el contenido de la app (no
 * lo difumina: las páginas ni siquiera se montan). Muestra el usuario de la
 * sesión local (E-16) y pide su contraseña. La validación (servidor si
 * responde; si no, verificador local) y la espera progresiva viven en
 * contexto/bloqueo.ts. El indicador de conectividad sigue montado, así que la
 * sincronización en segundo plano continúa mientras la app está bloqueada.
 */
export function PantallaBloqueo() {
  const { sesion, desbloquear, cambiarDeUsuario } = useSesion()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [usernameManual, setUsernameManual] = useState('')
  const [validando, setValidando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [esperaHastaMs, setEsperaHastaMs] = useState(0)
  const [ahora, setAhora] = useState(() => Date.now())

  const sinUsername = !sesion?.username

  // Si ya había una espera en curso (p. ej. tras recargar la página), se respeta.
  useEffect(() => {
    void almacenBloqueoDexie.leerIntentos().then((intentos) => setEsperaHastaMs(intentos.esperaHastaMs))
  }, [])

  const restanteMs = Math.max(0, esperaHastaMs - ahora)
  useEffect(() => {
    if (restanteMs <= 0) return
    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(intervalo)
  }, [restanteMs])

  async function manejarDesbloqueo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!password || restanteMs > 0) return
    setValidando(true)
    setMensaje(null)
    try {
      const resultado = await desbloquear(password, sinUsername ? usernameManual.trim() : undefined)
      setPassword('')
      const marca = Date.now()
      setAhora(marca)
      switch (resultado.tipo) {
        case 'DESBLOQUEADA':
          return
        case 'INCORRECTA':
          setEsperaHastaMs(resultado.esperaMs > 0 ? marca + resultado.esperaMs : 0)
          setMensaje(
            resultado.esperaMs > 0
              ? `Contraseña incorrecta. Demasiados intentos: espera ${textoEspera(resultado.esperaMs)} antes de volver a intentar.`
              : 'Contraseña incorrecta.',
          )
          return
        case 'ESPERA':
          setEsperaHastaMs(marca + resultado.esperaMs)
          setMensaje('Demasiados intentos fallidos. Espera antes de volver a intentar.')
          return
        case 'SIN_VERIFICADOR':
          setMensaje(
            'Sin conexión con el servidor no se puede validar la contraseña en este dispositivo todavía: ' +
              'hace falta conexión para desbloquear. El desbloqueo sin conexión queda listo después del ' +
              'siguiente inicio de sesión o desbloqueo con conexión.',
          )
          return
        case 'ERROR':
          setMensaje(resultado.mensaje)
      }
    } finally {
      setValidando(false)
    }
  }

  async function manejarCambioDeUsuario() {
    setMensaje(null)
    try {
      await cambiarDeUsuario()
      navigate('/login', { replace: true })
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo cambiar de usuario.')
    }
  }

  return (
    <div className="pantalla-bloqueo">
      <form className="tarjeta-bloqueo" onSubmit={manejarDesbloqueo}>
        <div className="marca">SADIM</div>
        <h1>App bloqueada</h1>
        {sinUsername ? (
          <>
            <label htmlFor="bloqueo-usuario">Usuario</label>
            <input
              id="bloqueo-usuario"
              autoComplete="username"
              value={usernameManual}
              onChange={(evento) => setUsernameManual(evento.target.value)}
              required
            />
          </>
        ) : (
          <p className="usuario-bloqueado">
            <span aria-hidden="true">👤</span> <strong>{sesion?.username}</strong>
          </p>
        )}
        <label htmlFor="bloqueo-password">Contraseña</label>
        <input
          id="bloqueo-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
          required
        />
        {mensaje && (
          <p className="mensaje-error" role="alert">
            {mensaje}
          </p>
        )}
        {restanteMs > 0 && <p className="campo-solo-lectura">Podrás intentar de nuevo en {textoEspera(restanteMs)}.</p>}
        <div className="acciones-formulario">
          <button type="submit" disabled={validando || restanteMs > 0 || !password}>
            {validando ? 'Validando…' : 'Desbloquear'}
          </button>
          <button type="button" className="boton-secundario" onClick={() => void manejarCambioDeUsuario()}>
            Cambiar de usuario
          </button>
        </div>
        <IndicadorConectividad />
      </form>
    </div>
  )
}

import { borrarSesion, guardarSesion, obtenerSesion } from '../db/baseLocal'
import { emitirSesionCerrada } from './eventosSesion'
import { ErrorApi } from './errorApi'

async function analizarError(respuesta: Response): Promise<ErrorApi> {
  try {
    const cuerpo = (await respuesta.json()) as {
      code?: string
      message?: string
      details?: Record<string, unknown>
    }
    return new ErrorApi(
      cuerpo.code ?? 'ERROR_INTERNO',
      cuerpo.message ?? 'Ocurrió un error inesperado.',
      cuerpo.details ?? {},
    )
  } catch {
    return new ErrorApi('ERROR_INTERNO', 'Ocurrió un error inesperado.', {})
  }
}

// Evita que dos peticiones simultáneas con el token vencido disparen dos
// renovaciones a la vez: la segunda espera el resultado de la primera.
let promesaRenovacion: Promise<string | null> | null = null

async function renovarToken(): Promise<string | null> {
  const sesion = await obtenerSesion()
  if (!sesion) return null

  const respuesta = await fetch('/api/auth/refresh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: sesion.refresh_token }),
  })
  if (!respuesta.ok) return null

  const datos = (await respuesta.json()) as { access_token: string }
  await guardarSesion({ ...sesion, access_token: datos.access_token })
  return datos.access_token
}

/**
 * Cliente HTTP para /api. Agrega Authorization: Bearer con el access_token de
 * la sesión guardada en Dexie; ante 401 NO_AUTENTICADO intenta renovar una
 * vez con /api/auth/refresh/ y reintenta la petición original. Si la
 * renovación falla, cierra la sesión local y avisa a la UI (evento
 * EVENTO_SESION_CERRADA) para que redirija a /login.
 */
export async function peticion<T>(
  ruta: string,
  opciones: RequestInit = {},
  reintentando = false,
): Promise<T> {
  const sesion = await obtenerSesion()
  const encabezados = new Headers(opciones.headers)
  encabezados.set('Content-Type', 'application/json')
  if (sesion?.access_token) {
    encabezados.set('Authorization', `Bearer ${sesion.access_token}`)
  }

  const respuesta = await fetch(`/api${ruta}`, { ...opciones, headers: encabezados })

  if (respuesta.ok) {
    if (respuesta.status === 204) {
      return undefined as T
    }
    return (await respuesta.json()) as T
  }

  const error = await analizarError(respuesta)

  if (respuesta.status === 401 && error.code === 'NO_AUTENTICADO' && !reintentando && sesion) {
    promesaRenovacion ??= renovarToken().finally(() => {
      promesaRenovacion = null
    })
    const nuevoToken = await promesaRenovacion

    if (nuevoToken) {
      return peticion<T>(ruta, opciones, true)
    }

    await borrarSesion()
    emitirSesionCerrada()
    throw new ErrorApi('SESION_EXPIRADA', 'La sesión terminó. Vuelve a iniciar sesión.')
  }

  throw error
}

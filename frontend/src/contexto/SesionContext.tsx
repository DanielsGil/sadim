import { createContext, use, useEffect, useState, type ReactNode } from 'react'
import { cerrarSesion as cerrarSesionApi, iniciarSesion as iniciarSesionApi } from '../api/auth'
import { EVENTO_SESION_CERRADA } from '../api/eventosSesion'
import { obtenerSesion } from '../db/baseLocal'
import type { Sesion } from '../tipos/dominio'

interface SesionContextValor {
  sesion: Sesion | null
  /** true mientras se lee la sesión guardada en Dexie al arrancar la app. */
  cargando: boolean
  iniciarSesion: (username: string, password: string) => Promise<void>
  cerrarSesion: () => Promise<void>
}

const SesionContext = createContext<SesionContextValor | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    obtenerSesion().then((sesionGuardada) => {
      setSesion(sesionGuardada ?? null)
      setCargando(false)
    })

    // El cliente HTTP dispara esto cuando falla la renovación del token.
    const manejarSesionCerrada = () => setSesion(null)
    window.addEventListener(EVENTO_SESION_CERRADA, manejarSesionCerrada)
    return () => window.removeEventListener(EVENTO_SESION_CERRADA, manejarSesionCerrada)
  }, [])

  async function iniciarSesion(username: string, password: string) {
    const nuevaSesion = await iniciarSesionApi(username, password)
    setSesion(nuevaSesion)
  }

  async function cerrarSesion() {
    await cerrarSesionApi()
    setSesion(null)
  }

  return (
    <SesionContext value={{ sesion, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </SesionContext>
  )
}

export function useSesion(): SesionContextValor {
  const contexto = use(SesionContext)
  if (!contexto) {
    throw new Error('useSesion debe usarse dentro de SesionProvider')
  }
  return contexto
}

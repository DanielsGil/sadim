import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { cerrarSesion as cerrarSesionApi, iniciarSesion as iniciarSesionApi } from '../api/auth'
import { obtenerConfiguracionModulos } from '../api/configuracion'
import { EVENTO_SESION_CERRADA } from '../api/eventosSesion'
import { ErrorColaDeOtroUsuario } from './erroresSesion'
import {
  borrarBandejasLocales,
  borrarSesion as borrarSesionLocal,
  obtenerPropietarioCola,
  obtenerSesion,
} from '../db/baseLocal'
import { contarOperacionesPendientes, dispararSincronizacion } from '../sync/enrutador'
import type { ConfiguracionModulo, Sesion } from '../tipos/dominio'

interface SesionContextValor {
  sesion: Sesion | null
  /** true mientras se lee la sesión guardada en Dexie al arrancar la app. */
  cargando: boolean
  iniciarSesion: (username: string, password: string) => Promise<void>
  cerrarSesion: () => Promise<void>
  /**
   * Estado de los módulos (HU-042), para que el menú oculte las secciones
   * de un módulo desactivado. null mientras no se ha cargado; ocultar
   * siempre es solo experiencia de usuario (la autorización real está en
   * el backend, ADR-005/ADR-006).
   */
  modulos: ConfiguracionModulo | null
  recargarModulos: () => Promise<void>
}

const SesionContext = createContext<SesionContextValor | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [modulos, setModulos] = useState<ConfiguracionModulo | null>(null)

  const recargarModulos = useCallback(async () => {
    try {
      setModulos(await obtenerConfiguracionModulos())
    } catch {
      // Si falla (por ejemplo sin red), el menú no oculta nada: mejor
      // mostrar de más que ocultar por error, ya que el backend igual
      // aplica la regla real.
      setModulos(null)
    }
  }, [])

  useEffect(() => {
    obtenerSesion().then((sesionGuardada) => {
      setSesion(sesionGuardada ?? null)
      setCargando(false)
      if (sesionGuardada) {
        void recargarModulos()
        // HU-032 lado cliente: sincroniza al abrir la app si ya hay sesión.
        void dispararSincronizacion()
      }
    })

    // El cliente HTTP dispara esto cuando falla la renovación del token.
    const manejarSesionCerrada = () => setSesion(null)
    window.addEventListener(EVENTO_SESION_CERRADA, manejarSesionCerrada)
    return () => window.removeEventListener(EVENTO_SESION_CERRADA, manejarSesionCerrada)
  }, [recargarModulos])

  async function iniciarSesion(username: string, password: string) {
    const nuevaSesion = await iniciarSesionApi(username, password)
    // D21: si la cola tiene operaciones de OTRO usuario, no se admite este
    // login (solo el mismo usuario puede seguir para poder sincronizarlas).
    const propietario = await obtenerPropietarioCola()
    if (propietario && propietario !== nuevaSesion.usuario_id) {
      await borrarSesionLocal()
      throw new ErrorColaDeOtroUsuario()
    }
    setSesion(nuevaSesion)
    await recargarModulos()
  }

  async function cerrarSesion() {
    // D21: no se puede cerrar sesión mientras la cola tenga operaciones.
    const pendientes = await contarOperacionesPendientes()
    if (pendientes > 0) {
      throw new Error(
        `Hay ${pendientes} operación(es) sin sincronizar. Conéctate para sincronizar antes de cerrar sesión.`,
      )
    }
    await cerrarSesionApi()
    // E-19: las bandejas de selección guardadas se borran al cerrar sesión.
    await borrarBandejasLocales()
    setSesion(null)
    setModulos(null)
  }

  return (
    <SesionContext
      value={{ sesion, cargando, iniciarSesion, cerrarSesion, modulos, recargarModulos }}
    >
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

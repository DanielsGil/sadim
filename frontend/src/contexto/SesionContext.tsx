import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'
import { cerrarSesion as cerrarSesionApi, iniciarSesion as iniciarSesionApi } from '../api/auth'
import { obtenerConfiguracionModulos } from '../api/configuracion'
import { EVENTO_SESION_CERRADA } from '../api/eventosSesion'
import { servidorDisponible } from '../api/salud'
import { ErrorColaDeOtroUsuario } from './erroresSesion'
import { intentarDesbloqueo, renovarVerificador, type ResultadoDesbloqueo } from './bloqueo'
import { debeBloquearAlVolver } from './inactividad'
import {
  almacenBloqueoDexie,
  borrarBandejasLocales,
  borrarSesion as borrarSesionLocal,
  guardarSesionBloqueada,
  guardarUltimaActividad,
  obtenerPropietarioCola,
  obtenerSesion,
  obtenerSesionBloqueada,
  obtenerUltimaActividad,
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
  /** D30 (E-22): la app está bloqueada; la sesión, la cola y la copia local siguen intactas. */
  bloqueada: boolean
  bloquear: () => void
  /** `username` solo hace falta en sesiones guardadas antes de E-16, que no lo tienen. */
  desbloquear: (password: string, username?: string) => Promise<ResultadoDesbloqueo>
  /**
   * D30 + D21: «Cambiar de usuario» desde la pantalla de bloqueo. Solo con el
   * servidor respondiendo y la cola vacía; si no, lanza un Error que lo explica.
   */
  cambiarDeUsuario: () => Promise<void>
}

const SesionContext = createContext<SesionContextValor | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [modulos, setModulos] = useState<ConfiguracionModulo | null>(null)
  const [bloqueada, setBloqueada] = useState(false)

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
    void (async () => {
      const sesionGuardada = await obtenerSesion()
      if (sesionGuardada) {
        // D30, caso 1: al abrir la app se bloquea si quedó bloqueada o si
        // pasaron más de 5 minutos desde la última interacción.
        const yaBloqueada = await obtenerSesionBloqueada()
        if (yaBloqueada || debeBloquearAlVolver(await obtenerUltimaActividad(), Date.now())) {
          await guardarSesionBloqueada(true)
          setBloqueada(true)
        }
      }
      setSesion(sesionGuardada ?? null)
      setCargando(false)
      if (sesionGuardada) {
        void recargarModulos()
        // HU-032 lado cliente: sincroniza al abrir la app si ya hay sesión
        // (también bloqueada: la sincronización sigue en segundo plano).
        void dispararSincronizacion()
      }
    })()

    // El cliente HTTP dispara esto cuando falla la renovación del token.
    const manejarSesionCerrada = () => {
      setSesion(null)
      setBloqueada(false)
    }
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
    // D30: en cada login exitoso en línea se renueva el verificador local
    // (PBKDF2, 600.000 iteraciones). Va en segundo plano para no demorar la entrada.
    void renovarVerificador(almacenBloqueoDexie, password, nuevaSesion.usuario_id, username).catch(() => undefined)
    setBloqueada(false)
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
    // D30: el cierre manual también borra el verificador local de la contraseña.
    await cerrarSesionApi()
    // E-19: las bandejas de selección guardadas se borran al cerrar sesión.
    await borrarBandejasLocales()
    setBloqueada(false)
    setSesion(null)
    setModulos(null)
  }

  /** D30: bloquear NUNCA borra la cola, la copia local ni las bandejas; solo marca el bloqueo. */
  const bloquear = useCallback(() => {
    setBloqueada(true)
    void guardarSesionBloqueada(true)
  }, [])

  async function desbloquear(password: string, username?: string): Promise<ResultadoDesbloqueo> {
    if (!sesion) return { tipo: 'ERROR', mensaje: 'No hay una sesión guardada.' }
    const resultado = await intentarDesbloqueo(
      { usuario_id: sesion.usuario_id, username: sesion.username ?? username ?? '' },
      password,
      {
        almacen: almacenBloqueoDexie,
        servidorDisponible: () => servidorDisponible(),
        loginServidor: async (username, clave) => {
          // Login de siempre: guarda los tokens nuevos en la sesión local.
          setSesion(await iniciarSesionApi(username, clave))
        },
        ahora: () => Date.now(),
      },
    )
    if (resultado.tipo === 'DESBLOQUEADA') {
      await guardarUltimaActividad(Date.now())
      await guardarSesionBloqueada(false)
      setBloqueada(false)
    }
    return resultado
  }

  async function cambiarDeUsuario() {
    const pendientes = await contarOperacionesPendientes()
    if (pendientes > 0) {
      throw new Error(
        `Hay ${pendientes} operación(es) sin sincronizar de este usuario. Para cambiar de usuario, primero ` +
          'deben sincronizarse: desbloquea con tu contraseña o espera a tener conexión.',
      )
    }
    if (!(await servidorDisponible())) {
      throw new Error(
        'Cambiar de usuario requiere conexión con el servidor (el nuevo usuario debe iniciar sesión en línea).',
      )
    }
    await cerrarSesion()
  }

  return (
    <SesionContext
      value={{
        sesion,
        cargando,
        iniciarSesion,
        cerrarSesion,
        modulos,
        recargarModulos,
        bloqueada,
        bloquear,
        desbloquear,
        cambiarDeUsuario,
      }}
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

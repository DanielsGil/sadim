import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { IndicadorConectividad } from './IndicadorConectividad'
import { PantallaBloqueo } from './PantallaBloqueo'
import { useElementosNavegacion } from './navegacion'
import {
  BLOQUEO_SESION,
  debeBloquearAlVolver,
  TemporizadorInactividad,
  type EstadoInactividad,
} from '../contexto/inactividad'
import { useSesion } from '../contexto/SesionContext'
import { guardarUltimaActividad, obtenerUltimaActividad } from '../db/baseLocal'

const EVENTOS_ACTIVIDAD = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
/** F-20: cada cuánto, como máximo, se escribe `meta.ultima_actividad` en Dexie. */
const INTERVALO_GUARDADO_ACTIVIDAD_MS = 30 * 1000

/**
 * Estructura de escritorio con navegación lateral (criterio de diseño de los
 * wireframes, §"Criterio de diseño"), y en pantallas <768px una barra de
 * navegación inferior fija con hoja "Más" (E-01, lote de correcciones 1):
 * la lista de secciones y su ocultamiento por rol/módulo es la MISMA en
 * ambos casos (`useElementosNavegacion`), solo cambia la presentación.
 *
 * HU-042: el catálogo, usuarios y configuración son rutas del núcleo y no
 * dependen de ninguna bandera (Contrato v2 §12); Ventas/Mesas, Inventario y
 * Caja sí se ocultan cuando su bandera está desactivada (`modulos?.x_activo`).
 * Antes de que `modulos` termine de cargar (null) se muestran de más en vez de
 * ocultar por error: el backend igual aplica la regla real (ADR-005/006).
 */
export function Layout() {
  const { sesion, cerrarSesion, bloqueada, bloquear } = useSesion()
  const elementos = useElementosNavegacion()
  const navigate = useNavigate()
  const [errorCierre, setErrorCierre] = useState<string | null>(null)
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const [cuentaAbierta, setCuentaAbierta] = useState(false)
  const [estadoInactividad, setEstadoInactividad] = useState<EstadoInactividad>('ACTIVA')

  // D30 (E-22, reemplaza a D27): la app se BLOQUEA, nunca cierra la sesión
  // sola. Caso 2: 15 min sin interacción con la app abierta (aviso 1 min
  // antes). Caso 1: al traerla al frente, si pasaron más de 5 min desde la
  // última interacción. Mientras está bloqueada no corre el temporizador.
  useEffect(() => {
    if (bloqueada) return
    const temporizador = new TemporizadorInactividad({
      bloquear,
      alCambiarEstado: setEstadoInactividad,
    })
    let cancelado = false
    let ultimaActividad = 0
    let ultimoGuardado = 0
    const alInteractuar = () => {
      const ahora = Date.now()
      if (ahora - ultimaActividad < 1000) return
      ultimaActividad = ahora
      temporizador.registrarActividad()
      // F-20: la última actividad se guarda en Dexie como máximo cada 30 s.
      if (ahora - ultimoGuardado >= INTERVALO_GUARDADO_ACTIVIDAD_MS) {
        ultimoGuardado = ahora
        void guardarUltimaActividad(ahora)
      }
    }
    // F-20: al ocultar o cerrar la página se guarda el último toque exacto.
    const alOcultar = () => {
      if (ultimaActividad > 0) void guardarUltimaActividad(ultimaActividad)
    }
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'hidden') {
        alOcultar()
        return
      }
      // D30, caso 1: la app vuelve al frente.
      void obtenerUltimaActividad()
        .catch(() => undefined)
        .then((guardada) => {
          if (cancelado) return
          const referencia = Math.max(guardada ?? 0, ultimaActividad) || undefined
          if (debeBloquearAlVolver(referencia, Date.now())) bloquear()
        })
    }

    // Al montar (también justo después de desbloquear) la cuenta sigue desde
    // la última actividad guardada; el bloqueo al ABRIR la app lo decide SesionContext.
    void obtenerUltimaActividad()
      .catch(() => undefined)
      .then((guardada) => {
        if (cancelado) return
        const ahora = Date.now()
        const referencia = Math.min(ahora, Math.max(guardada ?? ahora, ultimaActividad))
        temporizador.iniciar(ahora - referencia)
      })
    for (const evento of EVENTOS_ACTIVIDAD) {
      window.addEventListener(evento, alInteractuar, { passive: true, capture: true })
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    window.addEventListener('pagehide', alOcultar)
    return () => {
      cancelado = true
      temporizador.detener()
      alOcultar()
      for (const evento of EVENTOS_ACTIVIDAD) {
        window.removeEventListener(evento, alInteractuar, { capture: true })
      }
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      window.removeEventListener('pagehide', alOcultar)
    }
  }, [bloqueada, bloquear])

  // Máximo 5 elementos visibles a la vez en la barra inferior (E-01): si hay
  // más de 5 secciones en total, se muestran las primeras 4 y el resto pasa
  // al botón "Más"; si hay 5 o menos, caben todas sin necesidad de "Más".
  const necesitaMas = elementos.length > 5
  const primarios = necesitaMas ? elementos.slice(0, 4) : elementos
  const restantes = necesitaMas ? elementos.slice(4) : []

  const etiquetaRol = sesion?.rol === 'ADMIN' ? 'Administrador' : 'Operador'
  const nombreUsuario = sesion?.username ?? 'Usuario'

  async function manejarCerrarSesion() {
    try {
      setErrorCierre(null)
      // D21: con operaciones en la cola, cerrarSesion lanza el error que explica por qué.
      await cerrarSesion()
      navigate('/login', { replace: true })
    } catch (error) {
      setErrorCierre(error instanceof Error ? error.message : 'No se pudo cerrar sesión.')
    }
  }

  // D30: bloqueada, la pantalla de bloqueo reemplaza TODO el contenido.
  if (bloqueada) return <PantallaBloqueo />

  return (
    <div className="app-shell">
      <aside className="barra-lateral">
        <div className="marca">SADIM</div>
        <nav className="navegacion-lateral">
          {elementos.map((elemento) => (
            <NavLink key={elemento.to} to={elemento.to} end={elemento.fin}>
              {elemento.etiqueta}
            </NavLink>
          ))}
        </nav>
        <div className="barra-lateral-pie">
          <IndicadorConectividad />
          <span className="usuario-actual">{nombreUsuario}</span>
          <span className="rol-actual">{etiquetaRol}</span>
          {errorCierre && (
            <p className="mensaje-error" role="alert">
              {errorCierre}
            </p>
          )}
          <button type="button" className="boton-secundario" onClick={manejarCerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* E-16: en celular, la cuenta (usuario, rol y «Cerrar sesión») vive en una
          barra superior fija, siempre visible para ambos roles, sin depender de
          cuántas secciones haya ni de si aparece «Más». */}
      <header className="barra-superior-movil">
        <span className="marca">SADIM</span>
        <button
          type="button"
          className="boton-cuenta"
          aria-expanded={cuentaAbierta}
          aria-label="Cuenta"
          onClick={() => setCuentaAbierta((abierta) => !abierta)}
        >
          <span aria-hidden="true">👤</span> {nombreUsuario}
        </button>
        {cuentaAbierta && (
          <div className="panel-cuenta">
            <strong className="usuario-actual">{nombreUsuario}</strong>
            <span className="rol-actual">{etiquetaRol}</span>
            <IndicadorConectividad />
            {errorCierre && (
              <p className="mensaje-error" role="alert">
                {errorCierre}
              </p>
            )}
            <button type="button" className="boton-secundario" onClick={manejarCerrarSesion}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      <main className="contenido-principal">
        {estadoInactividad === 'AVISO' && (
          <p className="aviso-inactividad" role="alert">
            Por inactividad, la app se bloqueará en {Math.round(BLOQUEO_SESION.avisoMs / 1000)} segundos.
            Toca la pantalla para seguir trabajando.
          </p>
        )}
        <Outlet />
      </main>

      <nav className="barra-inferior" aria-label="Navegación principal">
        {primarios.map((elemento) => (
          <NavLink key={elemento.to} to={elemento.to} end={elemento.fin} className="item-barra-inferior">
            <span className="icono-barra-inferior" aria-hidden="true">
              {elemento.icono}
            </span>
            <span>{elemento.etiquetaCorta}</span>
          </NavLink>
        ))}
        {necesitaMas && (
          <button
            type="button"
            className="item-barra-inferior boton-mas"
            onClick={() => setHojaAbierta(true)}
          >
            <span className="icono-barra-inferior" aria-hidden="true">
              ⋯
            </span>
            <span>Más</span>
          </button>
        )}
      </nav>

      {hojaAbierta && (
        <div className="fondo-hoja" onClick={() => setHojaAbierta(false)}>
          <div className="hoja-mas" onClick={(evento) => evento.stopPropagation()}>
            <div className="hoja-mas-agarradera" aria-hidden="true" />
            <nav className="lista-hoja-mas">
              {restantes.map((elemento) => (
                <NavLink
                  key={elemento.to}
                  to={elemento.to}
                  end={elemento.fin}
                  onClick={() => setHojaAbierta(false)}
                >
                  <span aria-hidden="true">{elemento.icono}</span> {elemento.etiqueta}
                </NavLink>
              ))}
            </nav>
            <div className="hoja-mas-pie">
              <IndicadorConectividad />
              <span className="rol-actual">
                {sesion?.rol === 'ADMIN' ? 'Administrador' : 'Operador'}
              </span>
              {errorCierre && (
                <p className="mensaje-error" role="alert">
                  {errorCierre}
                </p>
              )}
              <button type="button" className="boton-secundario" onClick={manejarCerrarSesion}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
